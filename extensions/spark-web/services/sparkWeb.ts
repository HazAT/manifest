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
  authAttempts.set(ip, timestamps)
  if (timestamps.length >= AUTH_RATE_LIMIT) {
    const oldest = timestamps[0]
    const retryAfter = Math.ceil((oldest + AUTH_RATE_WINDOW - now) / 1000)
    return { allowed: false, retryAfter }
  }
  timestamps.push(now)
  return { allowed: true }
}

/** Login page HTML. */
const loginPageHtml = (error?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spark — Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { width: 100%; max-width: 360px; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #00ff88; }
    .error { background: #331111; border: 1px solid #ff4444; color: #ff6666; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem; }
    label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: #888; }
    input { width: 100%; padding: 0.6rem; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; font-family: monospace; font-size: 0.9rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #00ff88; }
    button { width: 100%; padding: 0.6rem; background: #00ff88; color: #0a0a0a; border: none; font-family: monospace; font-size: 0.9rem; font-weight: bold; cursor: pointer; }
    button:hover { background: #00cc6a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Spark</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/auth">
      <label for="token">Token</label>
      <input type="password" id="token" name="token" required autofocus>
      <button type="submit">Authenticate</button>
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

          if (parsed.type === 'prompt' && typeof parsed.message === 'string') {
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
  if (!sparkConfig.web?.enabled) {
    console.error('⚡ Spark web UI is not enabled in config/spark.ts')
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
