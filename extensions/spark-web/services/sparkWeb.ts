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

        // Dashboard HTML at root
        if (pathname === '/' || pathname === '') {
          const reqToken = url.searchParams.get('token')
          if (!reqToken || !safeTokenCompare(reqToken, token)) {
            return new Response('Unauthorized', { status: 401 })
          }
          return new Response(cachedHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }

        // WebSocket upgrade
        if (pathname === '/ws') {
          const reqToken = url.searchParams.get('token')
          if (!reqToken || !safeTokenCompare(reqToken, token)) {
            return new Response('Unauthorized', { status: 401 })
          }
          const upgraded = server.upgrade(req, { data: { token: reqToken } } as any)
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
