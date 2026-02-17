import fs from 'fs/promises'
import path from 'path'
import sparkConfig from '../../../config/spark'

/** Event emitted by Spark when an error occurs in the application. */
export type SparkEvent = {
  type: 'server-error' | 'unhandled-error' | 'process-error'
  traceId: string
  timestamp?: string
  environment?: string
  feature?: string
  route?: string
  status?: number
  error: { message: string; stack?: string }
  request?: { input?: Record<string, unknown> }
  /** Command that was run (process-error events) */
  command?: string
  /** Process exit code (process-error events) */
  exitCode?: number
  /** Path to the full log file (process-error events) */
  logFile?: string
  /** Last ~50 lines of process output (process-error events) */
  tail?: string
}

/** Pause file contents written to .spark/pause. */
type PauseInfo = {
  by?: string
  since: string
  reason: string
}

const SPARK_DIR = '.spark'
const PAUSE_FILE = path.join(SPARK_DIR, 'pause')

/** Spark event emission service. Writes event files atomically and manages pause/resume state. */
export const spark = {
  /** Write a JSON event file atomically to .spark/events/. No-op when Spark is disabled. */
  async emit(event: SparkEvent): Promise<void> {
    if (!sparkConfig.enabled) return

    const eventsDir = sparkConfig.eventsDir
    await fs.mkdir(eventsDir, { recursive: true })

    const enriched = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      environment: event.environment || sparkConfig.environment,
    }

    const filename = `${Date.now()}-${event.type}-${crypto.randomUUID().slice(0, 8)}.json`
    const finalPath = path.join(eventsDir, filename)
    const tmpPath = path.join(eventsDir, `.${filename}.tmp`)

    await fs.writeFile(tmpPath, JSON.stringify(enriched, null, 2))
    await fs.rename(tmpPath, finalPath)
  },

  /** Write a .spark/pause file to signal agents to back off. */
  async pause(reason: string, by?: string): Promise<void> {
    await fs.mkdir(SPARK_DIR, { recursive: true })
    const info: PauseInfo = { by, since: new Date().toISOString(), reason }
    await fs.writeFile(PAUSE_FILE, JSON.stringify(info, null, 2))
  },

  /** Remove the .spark/pause file to resume event processing. */
  async resume(): Promise<void> {
    try {
      await fs.unlink(PAUSE_FILE)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  },

  /** Check if Spark is currently paused. */
  async isPaused(): Promise<boolean> {
    try {
      await fs.access(PAUSE_FILE)
      return true
    } catch {
      return false
    }
  },

  /** Return current Spark status: enabled, environment, pause state, pending event count. */
  async status(): Promise<{
    enabled: boolean
    environment: string
    paused: boolean
    pauseInfo?: PauseInfo
    pendingEvents: number
  }> {
    let paused = false
    let pauseInfo: PauseInfo | undefined
    let pendingEvents = 0

    try {
      const raw = await fs.readFile(PAUSE_FILE, 'utf-8')
      paused = true
      pauseInfo = JSON.parse(raw)
    } catch {}

    try {
      const files = await fs.readdir(sparkConfig.eventsDir)
      pendingEvents = files.filter((f) => f.endsWith('.json')).length
    } catch {}

    return {
      enabled: sparkConfig.enabled,
      environment: sparkConfig.environment,
      paused,
      ...(pauseInfo ? { pauseInfo } : {}),
      pendingEvents,
    }
  },
}
