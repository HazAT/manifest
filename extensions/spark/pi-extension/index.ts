import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

type SparkEvent = {
  type: string
  traceId: string
  timestamp: string
  environment?: string
  feature?: string
  route?: string
  status?: number
  error?: { message: string; stack?: string }
  request?: { input?: Record<string, unknown> }
  command?: string
  exitCode?: number
  logFile?: string
  tail?: string
  ip?: string
  limit?: { max: number; windowSeconds: number }
  remaining?: number
  retryAfter?: number
}

type PauseInfo = {
  by?: string
  since: string
  reason: string
}

type SparkConfig = {
  enabled: boolean
  environment: string
  eventsDir: string
  watch: { unhandledErrors: boolean; serverErrors: boolean; processErrors: boolean }
  environments: Record<string, { tools: 'full'; behavior: 'fix' }>
  pause: { staleThresholdMinutes: number }
  debounce: { windowMs: number }
}

export default function spark(pi: ExtensionAPI) {
  let watcher: fs.FSWatcher | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let config: SparkConfig | undefined
  let paused = false
  let bufferedEvents: SparkEvent[] = []
  let sessionCtx: any | undefined
  let ambientTimer: ReturnType<typeof setTimeout> | undefined
  let agentsWatcher: fs.FSWatcher | undefined

  // Role detection — sidecar mode skips all agent presence behavior
  const isSidecar = process.env.SPARK_ROLE === 'sidecar'

  // Agent presence state (human mode only)
  let agentId: string | undefined
  let agentFilePath: string | undefined
  let eventsPath: string | undefined

  async function writeAgentFile(status: 'idle' | 'working', startedAt?: string) {
    if (!agentFilePath || !agentId) return
    const data = {
      id: agentId,
      pid: process.pid,
      status,
      startedAt: startedAt || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }
    const tmpPath = agentFilePath + '.tmp'
    await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2))
    await fsp.rename(tmpPath, agentFilePath)
  }

  async function writeSparkEvent(type: string, cwd: string) {
    if (!eventsPath || !agentId) return
    const filename = `${Date.now()}-${type}-${agentId.slice(0, 8)}.json`
    const event = {
      type,
      agentId,
      pid: process.pid,
      timestamp: new Date().toISOString(),
      traceId: crypto.randomUUID(),
    }
    const tmpPath = path.join(eventsPath, `.${filename}.tmp`)
    const finalPath = path.join(eventsPath, filename)
    await fsp.writeFile(tmpPath, JSON.stringify(event, null, 2))
    await fsp.rename(tmpPath, finalPath)
  }

  function getEnvProfile(cfg: SparkConfig) {
    return cfg.environments[cfg.environment] || cfg.environments.development || { tools: 'full', behavior: 'fix' }
  }

  function sparkStatus(cfg: SparkConfig, isPaused: boolean): string {
    if (isPaused) return '⏸ Spark paused'
    const profile = getEnvProfile(cfg)
    return `⚡ Spark (${cfg.environment}/${profile.behavior})`
  }

  function formatEvent(event: SparkEvent): string {
    const lines: string[] = []

    if (event.type === 'process-error') {
      lines.push(`**process-error** — \`${event.command || 'unknown'}\``)
      if (event.exitCode !== undefined) lines.push(`Exit code: ${event.exitCode}`)
      if (event.logFile) lines.push(`Log: ${event.logFile}`)
      if (event.tail) {
        lines.push('```')
        lines.push(event.tail)
        lines.push('```')
      }
    } else if (event.type === 'rate-limit') {
      lines.push(`**rate-limit**${event.feature ? ` on \`${event.feature}\`` : ''}${event.route ? ` — ${event.route}` : ''}`)
      if (event.ip) lines.push(`IP: ${event.ip}`)
      if (event.limit) lines.push(`Limit: ${event.limit.max} req / ${event.limit.windowSeconds}s`)
      if (event.retryAfter) lines.push(`Retry after: ${event.retryAfter}s`)
    } else {
      lines.push(`**${event.type}**${event.feature ? ` in \`${event.feature}\`` : ''}${event.route ? ` — ${event.route}` : ''}`)
      if (event.status) lines.push(`Status: ${event.status}`)
      if (event.error) {
        lines.push(`Error: ${event.error.message}`)
        if (event.error.stack) {
          const truncated = event.error.stack.split('\n').slice(0, 8).join('\n')
          lines.push('```\n' + truncated + '\n```')
        }
      }
    }

    if (event.traceId) lines.push(`Trace: ${event.traceId}`)
    return lines.join('\n')
  }

  function formatBatch(events: SparkEvent[]): string {
    // Embed raw JSON so web UI can render structured cards
    const jsonBlock = '\n\n```spark-events\n' + JSON.stringify(events) + '\n```'
    if (events.length === 1) return `🔥 **Spark Event**\n\n${formatEvent(events[0]!)}${jsonBlock}`
    const header = `🔥 **${events.length} Spark Events**\n`
    const body = events.map((e, i) => `### Event ${i + 1}\n${formatEvent(e)}`).join('\n\n')
    return `${header}\n${body}${jsonBlock}`
  }

  async function readConfig(cwd: string): Promise<SparkConfig | undefined> {
    const configPath = path.join(cwd, 'config', 'spark.ts')
    try {
      await fsp.access(configPath)
      // config/spark.ts uses Bun.env which isn't available in Pi (Node.js).
      // Parse the file to extract static values and resolve env vars ourselves.
      const raw = await fsp.readFile(configPath, 'utf-8')

      // Defaults — matches config/spark.ts structure
      const env = process.env.SPARK_ENV || process.env.NODE_ENV || 'development'
      return {
        enabled: !raw.includes('enabled: false'),
        environment: env,
        eventsDir: '.spark/events',
        watch: {
          unhandledErrors: !raw.includes('unhandledErrors: false'),
          serverErrors: !raw.includes('serverErrors: false'),
          processErrors: !raw.includes('processErrors: false'),
        },
        environments: {
          development: { tools: 'full', behavior: 'fix' },
          production: { tools: 'full', behavior: 'fix' },
        },
        pause: { staleThresholdMinutes: 30 },
        debounce: { windowMs: 1000 },
      }
    } catch {
      return undefined
    }
  }

  async function readPause(cwd: string): Promise<PauseInfo | undefined> {
    try {
      const raw = await fsp.readFile(path.join(cwd, '.spark', 'pause'), 'utf-8')
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }

  async function readPendingEvents(eventsDir: string): Promise<{ events: SparkEvent[]; stale: string[]; recent: string[] }> {
    const events: SparkEvent[] = []
    const stale: string[] = []
    const recent: string[] = []
    const fiveMinAgo = Date.now() - 5 * 60 * 1000

    try {
      const files = await fsp.readdir(eventsDir)
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const fullPath = path.join(eventsDir, file)
        try {
          const raw = await fsp.readFile(fullPath, 'utf-8')
          const event = JSON.parse(raw) as SparkEvent
          const ts = new Date(event.timestamp).getTime()
          if (ts < fiveMinAgo) {
            stale.push(fullPath)
          } else {
            events.push(event)
            recent.push(fullPath)
          }
        } catch {
          stale.push(fullPath) // unparseable = stale
        }
      }
    } catch {}

    return { events, stale, recent }
  }

  async function cleanFiles(files: string[]) {
    for (const f of files) {
      try { await fsp.unlink(f) } catch {}
    }
  }

  async function collectAndProcess(eventsDir: string) {
    const { events, stale, recent } = await readPendingEvents(eventsDir)
    await cleanFiles([...stale, ...recent])

    if (events.length === 0) return

    // Human Pi filters out agent-* events (those are for the sidecar)
    const filtered = isSidecar ? events : events.filter(e => !e.type.startsWith('agent-'))
    if (filtered.length === 0) return

    if (paused) {
      bufferedEvents.push(...filtered)
      return
    }

    if (isSidecar) {
      injectEvents(filtered)
    } else {
      showAmbientEvents(filtered)
    }
  }

  function injectEvents(events: SparkEvent[]) {
    if (events.length === 0) return
    const message = formatBatch(events)
    pi.sendUserMessage(message, { deliverAs: 'followUp' })
  }

  function showAmbientStatus(message: string) {
    if (!sessionCtx) return
    if (ambientTimer) clearTimeout(ambientTimer)
    sessionCtx.ui.setStatus('spark-activity', message)
    ambientTimer = setTimeout(() => {
      ambientTimer = undefined
      sessionCtx?.ui.setStatus('spark-activity', undefined)
    }, 5000)
  }

  function showAmbientEvents(events: SparkEvent[]) {
    if (events.length === 0) return
    if (events.length === 1) {
      const e = events[0]!
      if (e.type === 'rate-limit') {
        showAmbientStatus(`⚡ Rate limit hit on ${e.feature || 'unknown'}`)
      } else {
        showAmbientStatus(`⚡ Spark caught a ${e.status || 500} in ${e.feature || 'unknown'}`)
      }
    } else {
      showAmbientStatus(`⚡ ${events.length} errors — Spark is watching`)
    }
  }

  function startWatcher(eventsDir: string, debounceMs: number) {
    try {
      watcher = fs.watch(eventsDir, (_eventType, filename) => {
        if (!filename?.endsWith('.json')) return
        if (debounceTimer) return // already waiting
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined
          collectAndProcess(eventsDir)
        }, debounceMs)
      })
    } catch {}
  }

  // System prompt injection
  pi.on('before_agent_start', async (event, ctx) => {
    if (!config) return

    const profile = getEnvProfile(config)
    const pauseInfo = await readPause(ctx.cwd)
    const pauseStatus = pauseInfo
      ? `PAUSED by ${pauseInfo.by || 'unknown'}: "${pauseInfo.reason}" (since ${pauseInfo.since})`
      : 'Active (not paused)'

    const sparkPrompt = `
# Spark — Manifest AI Sidekick

You are Spark, a Manifest-aware AI sidekick. You run alongside a Manifest application, watching for errors and events.

## Current State
- Environment: ${config.environment}
- Behavior mode: ${profile.behavior}
- Pause status: ${pauseStatus}
- Buffered events: ${bufferedEvents.length}

## What You Do
You receive events from the running application — errors, crashes, failures. You investigate, diagnose, and depending on your mode, either fix issues or report them.

${config.environment === 'production' ? `## Production Mode (Active)
You have full tools and the authority to fix issues — but you are operating on a live system. Every action carries real consequences.

**Before touching anything:**
1. Read the relevant feature file and understand the full context
2. Analyze the error thoroughly — check related services, schemas, config, recent commits
3. Assess blast radius: what else could this change affect?
4. Run \`bun run manifest spark pause 'fixing: [description]'\` before making changes

**When fixing:**
- Prefer the smallest, most surgical fix that resolves the issue
- Never refactor in production — fix the bug, nothing more
- If the fix is risky or ambiguous, explain your analysis and proposed fix to the user first
- Test your understanding before writing code — read the failing path end to end
- If you're uncertain about root cause, investigate more before acting

**After fixing:**
- Verify the fix resolves the original error
- Run \`bun run manifest spark resume\` when done

You are trusted with production access because the humans you work with are responsible engineers. Honor that trust by being deliberate, cautious, and transparent about what you're doing and why.
` : `## Development Mode (Active)
You have full coding tools. When an error comes in:
1. Read the relevant feature file to understand context
2. Analyze the error — check related services, schemas, config
3. Run \`bun run manifest spark pause 'fixing: [description]'\` before making changes
4. Fix the issue
5. Run \`bun run manifest spark resume\` when done
`}
## Coordination
If a pause file exists (.spark/pause), another agent or developer is working. Buffer events and wait. If you're about to make changes yourself, always pause first.

## Doctor Awareness
On startup you assessed the application state. Use that context when responding to events.

## Manifest Awareness
You understand Manifest conventions: features are in features/, one file per behavior, defineFeature() pattern, services in services/, schemas in schemas/. Read MANIFEST.md to orient yourself.
`

    return {
      systemPrompt: event.systemPrompt + '\n' + sparkPrompt.trim(),
    }
  })

  // Agent presence: track mutating tool calls (human mode only)
  pi.on('tool_call', async (event) => {
    if (isSidecar || !agentId) return
    const mutating = ['write', 'edit', 'bash']
    if (mutating.includes(event.toolName)) {
      try { await writeAgentFile('working') } catch {}
    }
  })

  // Agent presence: return to idle after agent turn ends (human mode only)
  pi.on('agent_end', async () => {
    if (isSidecar || !agentId) return
    try { await writeAgentFile('idle') } catch {}
  })

  // Startup sequence
  pi.on('session_start', async (_event, ctx) => {
    sessionCtx = ctx
    config = await readConfig(ctx.cwd)
    if (!config || !config.enabled) return

    const profile = getEnvProfile(config)
    const eventsDir = path.resolve(ctx.cwd, config.eventsDir)

    // Ensure events directory exists
    await fsp.mkdir(eventsDir, { recursive: true })

    // Agent presence (human mode only)
    if (!isSidecar) {
      agentId = crypto.randomUUID()
      const agentsDir = path.resolve(ctx.cwd, '.spark', 'agents')
      await fsp.mkdir(agentsDir, { recursive: true })
      agentFilePath = path.join(agentsDir, `${agentId}.json`)
      eventsPath = eventsDir
      await writeAgentFile('idle', new Date().toISOString())
      await writeSparkEvent('agent-start', ctx.cwd)
    }

    // --- Doctor check ---
    const report: string[] = ['⚡ **Spark starting up**']
    report.push(`Environment: **${config.environment}** | Mode: **${profile.behavior}**`)

    // Git status
    try {
      const { execSync } = await import('node:child_process')
      const branch = execSync('git branch --show-current', { cwd: ctx.cwd, encoding: 'utf-8' }).trim()
      const status = execSync('git status --porcelain', { cwd: ctx.cwd, encoding: 'utf-8' }).trim()
      const uncommitted = status ? status.split('\n').length : 0
      report.push(`Git: branch \`${branch}\`${uncommitted > 0 ? `, ${uncommitted} uncommitted file${uncommitted > 1 ? 's' : ''}` : ', clean'}`)
    } catch {
      report.push('Git: not available')
    }

    // App status
    try {
      const manifestConfig = await import(path.join(ctx.cwd, 'config', 'manifest.ts') + `?t=${Date.now()}`)
      const appUrl = manifestConfig.default?.appUrl || 'http://localhost:8080'
      const resp = await fetch(appUrl, { signal: AbortSignal.timeout(2000) })
      report.push(`App: **running** at ${appUrl} (${resp.status})`)
    } catch {
      report.push('App: **not detected**')
    }

    // Pause check
    const pauseInfo = await readPause(ctx.cwd)
    if (pauseInfo) {
      const pausedSince = new Date(pauseInfo.since).getTime()
      const staleMs = config.pause.staleThresholdMinutes * 60 * 1000
      if (Date.now() - pausedSince > staleMs) {
        report.push(`⚠️ Stale pause detected (${pauseInfo.reason}, by ${pauseInfo.by || 'unknown'}, since ${pauseInfo.since}) — clearing`)
        try { await fsp.unlink(path.join(ctx.cwd, '.spark', 'pause')) } catch {}
        paused = false
      } else {
        report.push(`Paused: "${pauseInfo.reason}" by ${pauseInfo.by || 'unknown'}`)
        paused = true
      }
    } else {
      report.push('No pause detected')
      paused = false
    }

    // Pending events
    const { events, stale, recent } = await readPendingEvents(eventsDir)
    await cleanFiles(stale)
    if (events.length > 0) {
      report.push(`Pending events: **${events.length}** (will process after debounce)`)
    } else {
      report.push('No pending events')
    }

    // Send doctor report
    pi.sendMessage({
      customType: 'spark-status',
      content: report.join('\n'),
      display: true,
    })

    // Process pending recent events
    if (events.length > 0) {
      await cleanFiles(recent)
      if (paused) {
        bufferedEvents.push(...events)
      } else if (isSidecar) {
        // Delay injection slightly so startup message appears first
        setTimeout(() => injectEvents(events), 500)
      } else {
        // Human mode: ambient status for pending events
        const nonAgent = events.filter(e => !e.type.startsWith('agent-'))
        if (nonAgent.length > 0) setTimeout(() => showAmbientEvents(nonAgent), 500)
      }
    }

    // Start watcher
    startWatcher(eventsDir, config.debounce.windowMs)

    // Watch other agents (human mode only)
    if (!isSidecar) {
      const agentsDir = path.resolve(ctx.cwd, '.spark', 'agents')
      try {
        agentsWatcher = fs.watch(agentsDir, (_eventType, filename) => {
          if (!filename?.endsWith('.json') || !agentId) return
          // Filter out own agent file
          if (filename === `${agentId}.json`) return
          const filePath = path.join(agentsDir, filename)
          // Check if file exists (create) or was removed (delete)
          fsp.access(filePath).then(
            () => showAmbientStatus('🤖 Another agent joined'),
            () => showAmbientStatus('👋 Agent left')
          )
        })
      } catch {}
    }

    // Footer status
    ctx.ui.setStatus('spark', sparkStatus(config, paused))
  })

  // Cleanup
  pi.on('session_shutdown', async (_event, ctx) => {
    // Agent presence cleanup (human mode only)
    if (!isSidecar && agentId) {
      try { await writeSparkEvent('agent-stop', ctx?.cwd || '.') } catch {}
      if (agentFilePath) {
        try { await fsp.unlink(agentFilePath) } catch {}
      }
    }

    if (agentsWatcher) {
      agentsWatcher.close()
      agentsWatcher = undefined
    }
    if (watcher) {
      watcher.close()
      watcher = undefined
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }
    if (ambientTimer) {
      clearTimeout(ambientTimer)
      ambientTimer = undefined
    }
    sessionCtx = undefined
  })
}
