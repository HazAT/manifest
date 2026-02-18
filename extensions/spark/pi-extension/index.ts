import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import path from 'node:path'

type SparkEvent = {
  type: string
  traceId: string
  timestamp?: string
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

type SparkConfig = {
  enabled: boolean
  environment: string
  db: { pollIntervalMs: number; cleanup: { intervalMs: number } }
  watch: { unhandledErrors: boolean; serverErrors: boolean; processErrors: boolean }
  environments: Record<string, { tools: 'full'; behavior: 'fix' }>
}

type SparkDbService = {
  pollEvents(): SparkEvent[]
  cleanup(): void
  close(): void
}

export default function spark(pi: ExtensionAPI) {
  let config: SparkConfig | undefined
  let db: SparkDbService | undefined
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let cleanupTimer: ReturnType<typeof setInterval> | undefined

  function getEnvProfile(cfg: SparkConfig) {
    return cfg.environments[cfg.environment] || cfg.environments.development || { tools: 'full', behavior: 'fix' }
  }

  function sparkStatus(cfg: SparkConfig): string {
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
    const jsonBlock = '\n\n```spark-events\n' + JSON.stringify(events) + '\n```'
    if (events.length === 1) return `🔥 **Spark Event**\n\n${formatEvent(events[0]!)}${jsonBlock}`
    const header = `🔥 **${events.length} Spark Events**\n`
    const body = events.map((e, i) => `### Event ${i + 1}\n${formatEvent(e)}`).join('\n\n')
    return `${header}\n${body}${jsonBlock}`
  }

  async function readConfig(cwd: string): Promise<SparkConfig | undefined> {
    const configPath = path.join(cwd, 'config', 'spark.ts')
    try {
      const mod = await import(configPath + `?t=${Date.now()}`)
      const raw = mod.default
      if (!raw) return undefined
      return {
        enabled: raw.enabled !== false,
        environment: raw.environment || process.env.SPARK_ENV || process.env.NODE_ENV || 'development',
        db: {
          pollIntervalMs: raw.db?.pollIntervalMs ?? 1000,
          cleanup: { intervalMs: raw.db?.cleanup?.intervalMs ?? 300_000 },
        },
        watch: {
          unhandledErrors: raw.watch?.unhandledErrors !== false,
          serverErrors: raw.watch?.serverErrors !== false,
          processErrors: raw.watch?.processErrors !== false,
        },
        environments: raw.environments || {
          development: { tools: 'full', behavior: 'fix' },
          production: { tools: 'full', behavior: 'fix' },
        },
      }
    } catch {
      // Fallback: config may use Bun.env which isn't available outside Bun.
      // Parse the file for static values.
      try {
        const fsp = await import('node:fs/promises')
        const raw = await fsp.readFile(configPath, 'utf-8')
        const env = process.env.SPARK_ENV || process.env.NODE_ENV || 'development'
        return {
          enabled: !raw.includes('enabled: false'),
          environment: env,
          db: {
            pollIntervalMs: Number(raw.match(/pollIntervalMs\s*:\s*(\d+)/)?.[1]) || 1000,
            cleanup: { intervalMs: Number(raw.match(/intervalMs\s*:\s*([\d_]+)/)?.[1]?.replace(/_/g, '')) || 300_000 },
          },
          watch: {
            unhandledErrors: true,
            serverErrors: true,
            processErrors: true,
          },
          environments: {
            development: { tools: 'full', behavior: 'fix' },
            production: { tools: 'full', behavior: 'fix' },
          },
        }
      } catch {
        return undefined
      }
    }
  }

  function pollAndDeliver() {
    if (!db) return
    try {
      const events = db.pollEvents()
      if (events.length > 0) {
        pi.sendUserMessage(formatBatch(events), { deliverAs: 'followUp' })
      }
    } catch (err) {
      // Silently ignore poll errors — DB may be temporarily locked
    }
  }

  // System prompt injection
  pi.on('before_agent_start', async (event, ctx) => {
    if (!config) return

    const profile = getEnvProfile(config)

    const sparkPrompt = `
# Spark — Manifest AI Sidekick

You are Spark, a Manifest-aware AI sidekick. You run alongside a Manifest application, watching for errors and events.

## Current State
- Environment: ${config.environment}
- Behavior mode: ${profile.behavior}

## What You Do
You receive events from the running application — errors, crashes, failures. You investigate, diagnose, and fix issues.

${config.environment === 'production' ? `## Production Mode (Active)
You have full tools and the authority to fix issues — but you are operating on a live system. Every action carries real consequences.

**Before touching anything:**
1. Read the relevant feature file and understand the full context
2. Analyze the error thoroughly — check related services, schemas, config, recent commits
3. Assess blast radius: what else could this change affect?

**When fixing:**
- Prefer the smallest, most surgical fix that resolves the issue
- Never refactor in production — fix the bug, nothing more
- If the fix is risky or ambiguous, explain your analysis and proposed fix to the user first
- Test your understanding before writing code — read the failing path end to end
- If you're uncertain about root cause, investigate more before acting

You are trusted with production access because the humans you work with are responsible engineers. Honor that trust by being deliberate, cautious, and transparent about what you're doing and why.
` : `## Development Mode (Active)
You have full coding tools. When an error comes in:
1. Read the relevant feature file to understand context
2. Analyze the error — check related services, schemas, config
3. Fix the issue
`}
## Manifest Awareness
You understand Manifest conventions: features are in features/, one file per behavior, defineFeature() pattern, services in services/, schemas in schemas/.

## First-Run Orientation
When you start a session, proactively orient yourself before waiting for events:
1. Read \`AGENTS.md\` — project-specific conventions and instructions
2. Skim a few feature files to understand the app's patterns
3. Check available skills — load any that are relevant to your role

This takes a moment but means you can act on errors with full context instead of flying blind. You're not just a watcher — you're an engineer who knows the codebase.
`

    let fullPrompt = sparkPrompt.trim()

    // Append DB knowledge prompt if available
    const promptPath = path.resolve(ctx.cwd, 'extensions/spark/SPARK_PROMPT.md')
    try {
      const sparkDbPrompt = await Bun.file(promptPath).text()
      fullPrompt += '\n\n' + sparkDbPrompt.trim()
    } catch {}

    return {
      systemPrompt: event.systemPrompt + '\n' + fullPrompt,
    }
  })

  // Startup
  pi.on('session_start', async (_event, ctx) => {
    config = await readConfig(ctx.cwd)
    if (!config || !config.enabled) return

    const profile = getEnvProfile(config)

    // Import sparkDb from the project
    try {
      const dbMod = await import(path.join(ctx.cwd, 'services/sparkDb.ts'))
      db = dbMod.sparkDb as SparkDbService
    } catch (err) {
      pi.sendMessage({
        customType: 'spark-status',
        content: `⚡ **Spark** — failed to load sparkDb: ${err}`,
        display: true,
      })
      return
    }

    // Initial cleanup
    try { db.cleanup() } catch {}

    // Start polling and cleanup intervals
    pollTimer = setInterval(() => pollAndDeliver(), config.db.pollIntervalMs)
    cleanupTimer = setInterval(() => { try { db?.cleanup() } catch {} }, config.db.cleanup.intervalMs)

    // --- Startup report ---
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

    // Check for pending events
    try {
      const events = db.pollEvents()
      if (events.length > 0) {
        report.push(`Pending events: **${events.length}** (will process after debounce)`)
        // Inject pending events after a short delay so startup message appears first
        setTimeout(() => {
          pi.sendUserMessage(formatBatch(events), { deliverAs: 'followUp' })
        }, 500)
      } else {
        report.push('No pending events')
      }
    } catch {
      report.push('No pending events')
    }

    pi.sendMessage({
      customType: 'spark-status',
      content: report.join('\n'),
      display: true,
    })

    // Footer status
    ctx.ui.setStatus('spark', sparkStatus(config))
  })

  // Shutdown
  pi.on('session_shutdown', async () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
    if (db) {
      try { db.close() } catch {}
      db = undefined
    }
  })
}
