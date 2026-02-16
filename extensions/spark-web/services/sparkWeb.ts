import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

/**
 * Config shape for Spark Web sidecar. Mirrors config/spark.ts with projectDir added.
 */
export interface SparkSidecarConfig {
  environment: string
  web: { port: number; token: string; extensions?: string[] }
  projectDir: string
}

type WebSocketClient = {
  send(data: string | ArrayBuffer | Uint8Array): void
  close(): void
  data?: { token?: string }
}

/** Constant-time token comparison to prevent timing attacks. */
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Parse cookies from a request into a key-value map. */
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get('cookie') || ''
  const cookies: Record<string, string> = {}
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.split('=')
    if (key) cookies[key.trim()] = rest.join('=').trim()
  }
  return cookies
}

/** Check if request hostname is localhost. */
function isLocalhost(req: Request): boolean {
  const url = new URL(req.url)
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
}

/** In-memory rate limiter for auth endpoint. */
const authAttempts = new Map<string, number[]>()
const AUTH_RATE_LIMIT = 5
const AUTH_RATE_WINDOW = 60_000 // 60 seconds in ms

function checkAuthRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const timestamps = (authAttempts.get(ip) || []).filter(t => now - t < AUTH_RATE_WINDOW)
  if (timestamps.length === 0) {
    authAttempts.delete(ip)
  } else {
    authAttempts.set(ip, timestamps)
  }
  if (timestamps.length >= AUTH_RATE_LIMIT) {
    const oldest = timestamps[0]
    const retryAfter = Math.ceil((oldest + AUTH_RATE_WINDOW - now) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true }
}

/** Record a failed auth attempt for rate limiting. */
function recordAuthFailure(ip: string) {
  const now = Date.now()
  const timestamps = authAttempts.get(ip) || []
  timestamps.push(now)
  authAttempts.set(ip, timestamps)
}

/** Login page HTML. */
const loginPageHtml = (error?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spark — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'JetBrains Mono', ui-monospace, monospace; }
    ::selection { background: #00ff41; color: #000; }
    body { background: #000; color: #b0b0b0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    @keyframes spark-shimmer {
      0%, 100% { text-shadow: 0 0 4px rgba(255, 176, 0, 0.4), 0 0 11px rgba(255, 176, 0, 0.2), 0 0 30px rgba(255, 140, 0, 0.1); }
      50% { text-shadow: 0 0 6px rgba(255, 176, 0, 0.8), 0 0 20px rgba(255, 176, 0, 0.4), 0 0 45px rgba(255, 140, 0, 0.2), 0 0 80px rgba(255, 100, 0, 0.1); }
    }
    @keyframes ember-rise-1 {
      0% { opacity: 0; transform: translate(0, 0) scale(1); }
      20% { opacity: 1; }
      100% { opacity: 0; transform: translate(8px, -30px) scale(0); }
    }
    @keyframes ember-rise-2 {
      0% { opacity: 0; transform: translate(0, 0) scale(1); }
      25% { opacity: 0.8; }
      100% { opacity: 0; transform: translate(-6px, -25px) scale(0); }
    }
    .container { width: 100%; max-width: 380px; padding: 2rem; }
    .title { font-size: 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; }
    .spark-word {
      color: #ffb000;
      font-weight: 700;
      animation: spark-shimmer 3s ease-in-out infinite;
      position: relative;
      display: inline-block;
    }
    .spark-word::before, .spark-word::after {
      content: '';
      position: absolute;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #ffb000;
      opacity: 0;
    }
    .spark-word::before { right: 8px; top: 6px; animation: ember-rise-1 4s ease-out 1s infinite; }
    .spark-word::after { right: 2px; top: 10px; animation: ember-rise-2 4s ease-out 2.5s infinite; }
    .prompt-line { color: #555; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .prompt-line .cmd { color: #e0e0e0; }
    .cursor::after {
      content: '';
      display: inline-block;
      width: 0.55em;
      height: 1em;
      background: #00ff41;
      vertical-align: -0.15em;
      margin-left: 1px;
      animation: blink 1s step-end infinite;
    }
    .error-msg { background: #1a0a0a; border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.8rem; border-radius: 4px; }
    .error-msg::before { content: 'ERR '; color: #555; }
    label { display: block; font-size: 0.8rem; margin-bottom: 0.35rem; color: #555; }
    input {
      width: 100%; padding: 0.6rem; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 4px;
      color: #e0e0e0; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.85rem; margin-bottom: 1.25rem;
      transition: border-color 0.3s;
    }
    input:focus { outline: none; border-color: #00ff41; }
    button {
      width: 100%; padding: 0.6rem; background: #00ff41; color: #000; border: none; border-radius: 4px;
      font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.85rem; font-weight: 700; cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #00cc33; }
    .divider { height: 1px; background: linear-gradient(90deg, transparent, #1a1a1a 20%, #1a1a1a 80%, transparent); margin: 1.5rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">⚡ <span class="spark-word">Spark</span></div>
    <div class="prompt-line"><span class="cmd">$ authenticate</span><span class="cursor"></span></div>
    <div class="divider"></div>
    ${error ? '<div class="error-msg">' + error + '</div>' : ''}
    <form method="POST" action="/auth">
      <label for="token">token</label>
      <input type="password" id="token" name="token" required autofocus placeholder="enter access token">
      <button type="submit">authenticate →</button>
    </form>
  </div>
</body>
</html>`

/**
 * Starts the Spark Web sidecar: a standalone Bun.serve() that hosts the
 * dashboard HTML, WebSocket bridge, and an in-process Pi AgentSession
 * with the Spark extension loaded.
 *
 * Can be run directly: `bun extensions/spark-web/services/sparkWeb.ts`
 */
export async function startSparkSidecar(config: SparkSidecarConfig): Promise<void> {
  const token = config.web.token

  // Cache the HTML file in memory
  const htmlPath = path.resolve(__dirname, '../frontend/index.html')
  const cachedHtml = fs.readFileSync(htmlPath, 'utf-8')

  // Session store for cookie-based auth
  const sessions = new Set<string>()

  // Connected WebSocket clients
  const clients = new Set<WebSocketClient>()

  // Pause state
  const sparkDir = path.resolve(config.projectDir, '.spark')
  const pauseFile = path.join(sparkDir, 'pause')

  type PauseState = { paused: false } | { paused: true; by: string; since: string; reason: string }
  let currentPauseState: PauseState = { paused: false }

  async function readPauseState(): Promise<PauseState> {
    try {
      const raw = fs.readFileSync(pauseFile, 'utf-8')
      const info = JSON.parse(raw)
      return { paused: true, by: info.by || 'unknown', since: info.since, reason: info.reason }
    } catch {
      return { paused: false }
    }
  }

  async function writePause(reason: string, by: string): Promise<void> {
    const dir = path.dirname(pauseFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(pauseFile, JSON.stringify({ by, since: new Date().toISOString(), reason }, null, 2))
  }

  async function clearPause(): Promise<void> {
    try { fs.unlinkSync(pauseFile) } catch {}
  }

  function broadcastPauseState(state: PauseState) {
    broadcast({ type: 'pause_state', ...state })
  }

  // Watch .spark/ for pause file changes (from CLI or other agents)
  let pauseWatcher: ReturnType<typeof fs.watch> | undefined
  try {
    if (!fs.existsSync(sparkDir)) fs.mkdirSync(sparkDir, { recursive: true })
    pauseWatcher = fs.watch(sparkDir, async (_eventType, filename) => {
      if (filename !== 'pause') return
      const newState = await readPauseState()
      if (newState.paused !== currentPauseState.paused ||
          (newState.paused && currentPauseState.paused && newState.reason !== currentPauseState.reason)) {
        currentPauseState = newState
        broadcastPauseState(currentPauseState)
      }
    })
  } catch {}

  // Read initial pause state
  currentPauseState = await readPauseState()

  function broadcast(data: Record<string, unknown>) {
    const json = JSON.stringify(data)
    for (const client of clients) {
      try {
        client.send(json)
      } catch {
        clients.delete(client)
      }
    }
  }

  // --- AgentSession setup ---
  let session: any = null
  let sessionReady = false
  let sessionError: string | null = null

  try {
    const {
      createAgentSession,
      DefaultResourceLoader,
      SessionManager,
      AuthStorage,
      ModelRegistry,
      createCodingTools,
    } = await import('@mariozechner/pi-coding-agent')

    const cwd = config.projectDir
    const sparkExtensionPath = path.resolve(cwd, 'extensions/spark/pi-extension/index.ts')

    // Separate local paths from package sources (npm/git)
    const isPackageSource = (s: string) =>
      s.startsWith('npm:') || s.startsWith('git:') || s.startsWith('https://') || s.startsWith('http://') || s.startsWith('ssh://')

    const userExtensions = config.web.extensions || []
    const localPaths = userExtensions.filter(e => !isPackageSource(e)).map(e => path.resolve(cwd, e))
    const packageSources = userExtensions.filter(isPackageSource)

    const authStorage = new AuthStorage()
    const modelRegistry = new ModelRegistry(authStorage)

    const settingsManager = packageSources.length > 0
      ? (await import('@mariozechner/pi-coding-agent')).SettingsManager.inMemory({ packages: packageSources })
      : undefined

    const loader = new DefaultResourceLoader({
      cwd,
      ...(settingsManager ? { settingsManager } : {}),
      additionalExtensionPaths: [sparkExtensionPath, ...localPaths],
    })
    await loader.reload()

    const result = await createAgentSession({
      cwd,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      tools: createCodingTools(cwd),
    })

    session = result.session

    // Bind extensions with a headless UI context to trigger session_start
    // (which starts the Spark file watcher on .spark/events/)
    const noop = () => {}
    const noopAsync = async () => undefined as any
    const noopTheme = new Proxy({}, { get: () => (s: string) => s })
    await session.bindExtensions({
      uiContext: {
        select: noopAsync,
        confirm: async () => false,
        input: noopAsync,
        notify: noop,
        onTerminalInput: () => noop,
        setStatus: noop,
        setWorkingMessage: noop,
        setWidget: noop as any,
        setFooter: noop,
        setTitle: noop,
        custom: noopAsync,
        theme: noopTheme,
      } as any,
    })

    sessionReady = true

    // Subscribe to session events and broadcast to all connected clients
    session.subscribe((event: any) => {
      switch (event.type) {
        case 'message_start':
          broadcast({ type: 'message_start', message: event.message })
          break
        case 'message_update':
          broadcast({ type: 'message_update', event: event.assistantMessageEvent })
          break
        case 'message_end':
          broadcast({ type: 'message_end', message: event.message })
          break
        case 'tool_execution_start':
          broadcast({
            type: 'tool_start',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          })
          break
        case 'tool_execution_update':
          broadcast({
            type: 'tool_update',
            toolCallId: event.toolCallId,
            partialResult: event.partialResult,
          })
          break
        case 'tool_execution_end':
          broadcast({
            type: 'tool_end',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: event.result,
            isError: event.isError,
          })
          break
        case 'agent_start':
          broadcast({ type: 'agent_start' })
          break
        case 'agent_end':
          broadcast({ type: 'agent_end' })
          break
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[spark-web] Failed to create AgentSession: ${message}`)
    sessionError = message
  }

  // --- Start Bun.serve ---
  try {
    const server = Bun.serve({
      port: config.web.port,
      fetch(req, server) {
        const url = new URL(req.url)
        const pathname = url.pathname
        const cookies = parseCookies(req)
        const sessionId = cookies['spark_session']
        const hasValidSession = !!sessionId && sessions.has(sessionId)

        const buildCookie = (value: string, maxAge?: number) => {
          let cookie = `spark_session=${value}; HttpOnly; SameSite=Strict; Path=/`
          if (!isLocalhost(req)) cookie += '; Secure'
          if (maxAge !== undefined) cookie += `; Max-Age=${maxAge}`
          return cookie
        }

        // Dashboard or login at root
        if (pathname === '/' || pathname === '') {
          if (hasValidSession) {
            return new Response(cachedHtml, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          }
          return new Response(loginPageHtml(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }

        // Login endpoint
        if (pathname === '/auth' && req.method === 'POST') {
          const ip = server.requestIP(req)?.address || 'unknown'
          const rateCheck = checkAuthRateLimit(ip)
          if (!rateCheck.allowed) {
            return new Response(loginPageHtml('Too many attempts. Please wait and try again.'), {
              status: 429,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Retry-After': String(rateCheck.retryAfter),
              },
            })
          }

          // Parse form body
          return (async () => {
            const formData = await req.formData()
            const submittedToken = formData.get('token')
            if (typeof submittedToken !== 'string' || !safeTokenCompare(submittedToken, token)) {
              recordAuthFailure(ip)
              return new Response(loginPageHtml('Invalid token.'), {
                status: 401,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              })
            }
            const newSession = crypto.randomUUID()
            sessions.add(newSession)
            return new Response(null, {
              status: 302,
              headers: {
                'Location': '/',
                'Set-Cookie': buildCookie(newSession),
              },
            })
          })()
        }

        // Logout endpoint
        if (pathname === '/logout' && req.method === 'POST') {
          if (sessionId) sessions.delete(sessionId)
          return new Response(null, {
            status: 302,
            headers: {
              'Location': '/',
              'Set-Cookie': buildCookie('', 0),
            },
          })
        }

        // WebSocket upgrade
        if (pathname === '/ws') {
          if (!hasValidSession) {
            return new Response('Unauthorized', { status: 401 })
          }
          const upgraded = server.upgrade(req, { data: {} } as any)
          if (upgraded) return undefined as any
          return new Response('WebSocket upgrade failed', { status: 500 })
        }

        return new Response('Not Found', { status: 404 })
      },
      websocket: {
        open(ws: any) {
          clients.add(ws)

          // Send initial state
          const stateData: Record<string, unknown> = {
            environment: config.environment,
            sessionReady,
            sessionError,
            isStreaming: session?.isStreaming ?? false,
            model: session?.model?.id ?? null,
            messageCount: session?.messages?.length ?? 0,
          }
          try {
            ws.send(JSON.stringify({ type: 'state', data: stateData }))
            ws.send(JSON.stringify({ type: 'pause_state', ...currentPauseState }))
          } catch {}

          // Send message history
          if (session && sessionReady) {
            try {
              ws.send(JSON.stringify({ type: 'messages', messages: session.messages }))
            } catch {}
          }
        },

        message(ws: any, message: string | Buffer) {
          const raw = typeof message === 'string' ? message : message.toString()
          let parsed: any
          try {
            parsed = JSON.parse(raw)
          } catch {
            return
          }

          if (!session || !sessionReady) {
            try {
              ws.send(JSON.stringify({
                type: 'error',
                message: sessionError || 'Agent session not available',
              }))
            } catch {}
            return
          }

          if (parsed.type === 'pause') {
            const reason = parsed.reason || 'Paused from web UI'
            writePause(reason, 'spark-web').then(() => {
              currentPauseState = { paused: true, by: 'spark-web', since: new Date().toISOString(), reason }
              broadcastPauseState(currentPauseState)
            })
            return
          } else if (parsed.type === 'resume') {
            clearPause().then(() => {
              currentPauseState = { paused: false }
              broadcastPauseState(currentPauseState)
            })
            return
          } else if (parsed.type === 'prompt' && typeof parsed.message === 'string') {
            const doPrompt = async () => {
              try {
                if (session.isStreaming) {
                  await session.followUp(parsed.message)
                } else {
                  await session.prompt(parsed.message)
                }
              } catch (err: any) {
                const errMsg = err instanceof Error ? err.message : String(err)
                try {
                  ws.send(JSON.stringify({ type: 'error', message: errMsg }))
                } catch {}
              }
            }
            doPrompt()
          } else if (parsed.type === 'abort') {
            session.abort().catch(() => {})
          }
        },

        close(ws: any) {
          clients.delete(ws)
        },
      },
    })

    console.log(`⚡ Spark sidecar running on http://localhost:${server.port}`)
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE' || err?.message?.includes('address already in use') || err?.errno === -48) {
      console.log(`⚡ Spark sidecar already running on port ${config.web.port}`)
      process.exit(0)
    }
    throw err
  }
}

// Direct execution support
if (import.meta.main) {
  const sparkConfig = (await import('../../../config/spark')).default
  // A non-empty token implicitly enables the web UI (useful for Docker/env-only config)
  const webEnabled = sparkConfig.web?.enabled || !!sparkConfig.web?.token
  if (!webEnabled) {
    console.error('⚡ Spark web UI is not enabled. Set SPARK_WEB_TOKEN or enable in config/spark.ts')
    process.exit(1)
  }
  if (!sparkConfig.web.token) {
    console.error('⚡ No SPARK_WEB_TOKEN set. Set it in environment or config/spark.ts')
    process.exit(1)
  }
  await startSparkSidecar({
    environment: sparkConfig.environment,
    web: sparkConfig.web,
    projectDir: path.resolve(__dirname, '../../..'),
  })
}
