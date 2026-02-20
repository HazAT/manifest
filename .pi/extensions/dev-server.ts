import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'

type ServerState = 'stopped' | 'running' | 'paused' | 'crashed'

const DEFAULT_PORT = 3100
const MAX_PORT_SCAN = 50

export default function devServer(pi: ExtensionAPI) {
  let proc: ChildProcess | null = null
  let state: ServerState = 'stopped'
  let port = DEFAULT_PORT
  let cwd = ''
  let stoppedForTurn = false
  let lastExitCode: number | null = null
  let statusCtx: { ui: { setStatus: (id: string, text: string | undefined) => void; theme: any; notify: (msg: string, level: string) => void } } | null = null

  function readPort(projectDir: string): number {
    try {
      const raw = readFileSync(path.join(projectDir, 'config', 'manifest.ts'), 'utf-8')
      const match = raw.match(/appUrl.*?['"]([^'"]+)['"]/)
      if (match) {
        const url = new URL(match[1])
        return url.port ? parseInt(url.port, 10) : DEFAULT_PORT
      }
    } catch {}
    return DEFAULT_PORT
  }

  function writePort(projectDir: string, newPort: number): boolean {
    try {
      const configPath = path.join(projectDir, 'config', 'manifest.ts')
      let raw = readFileSync(configPath, 'utf-8')
      const updated = raw.replace(
        /(appUrl.*?['"])http:\/\/localhost:\d+(['"])/,
        `$1http://localhost:${newPort}$2`
      )
      if (updated === raw) return false
      writeFileSync(configPath, updated, 'utf-8')
      return true
    } catch {}
    return false
  }

  function isPortFree(p: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer()
      server.once('error', () => resolve(false))
      server.listen(p, '127.0.0.1', () => {
        server.close(() => resolve(true))
      })
    })
  }

  async function findFreePort(startPort: number): Promise<number | null> {
    for (let p = startPort; p < startPort + MAX_PORT_SCAN; p++) {
      if (await isPortFree(p)) return p
    }
    return null
  }

  function updateStatus() {
    if (!statusCtx) return
    const theme = statusCtx.ui.theme
    switch (state) {
      case 'running':
        statusCtx.ui.setStatus('dev-server', theme.fg('success', `🟢 Server http://localhost:${port}`))
        break
      case 'stopped':
        statusCtx.ui.setStatus('dev-server', theme.fg('dim', `🔴 Server stopped`))
        break
      case 'paused':
        statusCtx.ui.setStatus('dev-server', theme.fg('warning', `⏸ Server paused`))
        break
      case 'crashed':
        const exitInfo = lastExitCode !== null ? `exit ${lastExitCode}` : 'killed'
        statusCtx.ui.setStatus('dev-server', theme.fg('error', `🔴 Server crashed (${exitInfo})`))
        break
    }
  }

  function spawnServer(): { ok: boolean; message: string } {
    try {
      proc = spawn('bun', ['run', 'dev'], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PORT: String(port) },
      })
    } catch (err: any) {
      return { ok: false, message: `Failed to spawn server: ${err.message}` }
    }

    proc.on('error', (err) => {
      proc = null
      lastExitCode = null
      state = 'crashed'
      updateStatus()
    })

    proc.on('exit', (code, signal) => {
      proc = null
      if (state === 'paused' || state === 'stopped') return
      lastExitCode = code
      state = 'crashed'
      updateStatus()
    })

    // Drain stdout/stderr so the process doesn't block
    proc.stdout?.resume()
    proc.stderr?.resume()

    state = 'running'
    updateStatus()
    return { ok: true, message: `Server started on port ${port}.` }
  }

  async function startServer(): Promise<{ ok: boolean; message: string }> {
    if (proc && state === 'running') {
      return { ok: false, message: 'Server is already running.' }
    }

    // Check if configured port is free
    if (await isPortFree(port)) {
      return spawnServer()
    }

    // Port occupied — find the next free one
    const freePort = await findFreePort(port + 1)
    if (!freePort) {
      return { ok: false, message: `Port ${port} is occupied and no free port found in range ${port + 1}-${port + MAX_PORT_SCAN}.` }
    }

    const oldPort = port
    port = freePort
    const configUpdated = writePort(cwd, freePort)
    const result = spawnServer()

    if (result.ok) {
      const configNote = configUpdated
        ? `Updated config/manifest.ts appUrl to port ${freePort}.`
        : `Could not update config/manifest.ts — update appUrl manually.`
      result.message = `Port ${oldPort} was occupied. ${configNote} Server started on port ${freePort}.`
    }
    return result
  }

  function stopServer(): Promise<{ ok: boolean; message: string }> {
    if (!proc) {
      state = 'stopped'
      updateStatus()
      return Promise.resolve({ ok: false, message: 'Server is not running.' })
    }

    return new Promise((resolve) => {
      const p = proc!
      const killTimer = setTimeout(() => {
        try { p.kill('SIGKILL') } catch {}
      }, 3000)

      p.on('exit', () => {
        clearTimeout(killTimer)
        proc = null
        resolve({ ok: true, message: 'Server stopped.' })
      })

      try { p.kill('SIGTERM') } catch {}
    })
  }

  // --- Server command logic (shared by /server command and input event fallback) ---

  async function handleServerCommand(sub: string): Promise<boolean> {
    if (sub === 'start') {
      const result = await startServer()
      statusCtx?.ui.notify(result.message, result.ok ? 'info' : 'warning')
    } else if (sub === 'stop') {
      state = 'stopped'
      await stopServer()
      state = 'stopped'
      updateStatus()
      statusCtx?.ui.notify('Server stopped.', 'info')
    } else if (sub === 'restart') {
      state = 'stopped'
      await stopServer()
      const result = await startServer()
      statusCtx?.ui.notify(result.message, result.ok ? 'info' : 'warning')
    } else if (sub === 'status' || sub === '') {
      const msg = state === 'running'
        ? `Server is running on port ${port} (PID ${proc?.pid}).`
        : state === 'paused'
        ? `Server is paused (auto-stopped during edits).`
        : state === 'crashed'
        ? `Server crashed (${lastExitCode !== null ? `exit ${lastExitCode}` : 'killed'}).`
        : `Server is stopped.`
      statusCtx?.ui.notify(msg, 'info')
    } else {
      return false
    }
    return true
  }

  // --- Commands ---

  pi.registerCommand('server', {
    description: 'Manage the dev server: /server start|stop|restart|status',
    handler: async (args, ctx) => {
      statusCtx = ctx
      const sub = (args || '').trim().toLowerCase()
      if (!await handleServerCommand(sub)) {
        ctx.ui.notify(`Unknown subcommand: ${sub}. Use start, stop, restart, or status.`, 'warning')
      }
    },
  })

  // --- Auto-stop before file edits ---

  pi.on('tool_call', async (event) => {
    if (state !== 'running') return
    if (event.toolName !== 'write' && event.toolName !== 'edit') return
    if (stoppedForTurn) return

    stoppedForTurn = true
    state = 'paused'
    updateStatus()
    await stopServer()
    state = 'paused'
    updateStatus()
  })

  // --- Auto-restart after agent finishes ---

  pi.on('agent_end', async () => {
    if (!stoppedForTurn) return
    stoppedForTurn = false
    await startServer()
  })

  // --- Handle /server from sendUserMessage (execute_command uses this path) ---

  pi.on('input', async (event) => {
    const text = (event.text || '').trim()
    if (!text.startsWith('/server')) return { action: 'continue' as const }
    const sub = text.replace(/^\/server\s*/, '').toLowerCase()
    if (await handleServerCommand(sub)) return { action: 'handled' as const }
    return { action: 'continue' as const }
  })

  // --- System prompt injection ---

  pi.on('before_agent_start', async (event) => {
    const serverPrompt = `
## Dev Server Management

A dev server extension manages the \`bun run dev\` process. The server auto-pauses before file edits and auto-restarts when you finish.

**Commands (via execute_command tool):**
- \`/server start\` — start the dev server
- \`/server stop\` — stop the dev server
- \`/server restart\` — restart the dev server
- \`/server status\` — check if the server is running

Current state: ${state}${state === 'running' ? ` (port ${port})` : ''}
`
    return {
      systemPrompt: event.systemPrompt + '\n' + serverPrompt.trim(),
    }
  })

  // --- Lifecycle ---

  pi.on('session_start', async (_event, ctx) => {
    statusCtx = ctx
    cwd = ctx.cwd
    port = readPort(cwd)
    updateStatus()
  })

  pi.on('session_shutdown', async () => {
    if (proc) {
      state = 'stopped'
      await stopServer()
    }
  })
}
