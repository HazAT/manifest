import path from 'path'
import fs from 'fs'
import { scanAllFeatures } from './scanner'
import { createRouter } from './router'
import { validateInput } from './validator'
import { toEnvelope, createResultHelpers } from './envelope'
import { createStaticHandler, watchFrontend } from './frontend'
import { checkRateLimit, startCleanup } from '../services/rateLimiter'
import frontendConfig from '../config/frontend'
import manifestConfig from '../config/manifest'
import sparkConfig from '../config/spark'
import { sparkDb } from '../services/sparkDb'

const textEncoder = new TextEncoder()

export interface ManifestServerOptions {
  projectDir: string
  port?: number
}

export type ManifestServer = Awaited<ReturnType<typeof createManifestServer>>

export async function createManifestServer(options: ManifestServerOptions) {
  const registry = await scanAllFeatures(options.projectDir)
  const router = createRouter(registry)

  const sparkEnabled = sparkConfig.enabled
  const sparkWatchErrors = sparkEnabled && sparkConfig.watch.serverErrors

  // Static file serving (only if dist/ exists)
  const distDir = path.resolve(options.projectDir, frontendConfig.outputDir)
  const staticHandler = fs.existsSync(distDir)
    ? createStaticHandler(distDir, { spaFallback: frontendConfig.spaFallback })
    : null

  // Live reload SSE clients (dev mode only)
  const reloadClients = new Set<ReadableStreamDefaultController>()

  const requestedPort = options.port ?? 3000

  // Start periodic cleanup of stale rate limit entries
  startCleanup()

  let server: ReturnType<typeof Bun.serve>
  try {
    server = Bun.serve({
    port: requestedPort,
    fetch: async (req, server) => {
      const url = new URL(req.url)
      const method = req.method
      const pathname = url.pathname

      // Health check endpoint (no auth required)
      if (pathname === '/__health') {
        return Response.json({ status: 'ok', uptime: Math.round(process.uptime()) })
      }

      // Dev-only SSE endpoint for live reload
      if (pathname === '/__dev/reload' && manifestConfig.debug && frontendConfig.devReload) {
        const stream = new ReadableStream({
          start(controller) {
            reloadClients.add(controller)
            controller.enqueue('event: connected\ndata: connected\n\n')
          },
          cancel(controller) {
            reloadClients.delete(controller)
          },
        })
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        })
      }

      // Try to match route (single pass handles match, 405, and 404)
      const match = router.match(method, pathname)

      if (match.kind === 'method_not_allowed') {
        if (sparkEnabled) {
          try {
            sparkDb.logAccess({
              timestamp: new Date().toISOString(), method, path: pathname, status: 405,
              duration_ms: 0, ip: server.requestIP(req)?.address ?? undefined,
              user_agent: req.headers.get('user-agent') ?? undefined,
            })
          } catch {}
        }
        return Response.json({ status: 405, message: 'Method not allowed' }, { status: 405 })
      }

      if (match.kind === 'not_found') {
        // Fallback to static files
        if (staticHandler) {
          const staticResponse = staticHandler(pathname)
          if (staticResponse) return staticResponse
        }

        if (sparkEnabled) {
          try {
            sparkDb.logAccess({
              timestamp: new Date().toISOString(), method, path: pathname, status: 404,
              duration_ms: 0, ip: server.requestIP(req)?.address ?? undefined,
              user_agent: req.headers.get('user-agent') ?? undefined,
            })
          } catch {}
        }
        return Response.json({ status: 404, message: 'Not found' }, { status: 404 })
      }

      const { feature, params } = match
      const requestId = Bun.randomUUIDv7()
      const start = performance.now()

      // Rate limit check (before input parsing)
      if (feature.rateLimit) {
        const ip = server.requestIP(req)?.address ?? 'unknown'
        const key = `${feature.name}:${ip}`
        const result = checkRateLimit(key, feature.rateLimit)
        if (!result.allowed) {
          const durationMs = Math.round((performance.now() - start) * 100) / 100
          if (sparkEnabled) {
            try {
              sparkDb.logAccess({
                timestamp: new Date().toISOString(), method, path: pathname, status: 429,
                duration_ms: durationMs, ip, feature: feature.name, request_id: requestId,
                user_agent: req.headers.get('user-agent') ?? undefined,
              })
              if (sparkWatchErrors) {
                sparkDb.logEvent({
                  type: 'rate-limit',
                  traceId: requestId,
                  feature: feature.name,
                  route: `${method} ${pathname}`,
                  status: 429,
                })
              }
            } catch {}
          }
          return Response.json(
            {
              status: 429,
              message: 'Rate limit exceeded',
              meta: { feature: feature.name, request_id: requestId, duration_ms: durationMs },
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(result.retryAfter),
                'X-RateLimit-Limit': String(feature.rateLimit.max),
                'X-RateLimit-Remaining': '0',
              },
            },
          )
        }
      }

      const input: Record<string, unknown> = {}

      try {
        // Parse input from query params + JSON body + path params

        // Query params
        for (const [key, value] of url.searchParams) {
          input[key] = value
        }

        // JSON body
        if (req.body && req.headers.get('content-type')?.includes('application/json')) {
          try {
            const body = await req.json()
            if (body && typeof body === 'object') {
              Object.assign(input, body)
            }
          } catch {
            const durationMs400 = Math.round((performance.now() - start) * 100) / 100
            if (sparkEnabled) {
              try {
                sparkDb.logAccess({
                  timestamp: new Date().toISOString(), method, path: pathname, status: 400,
                  duration_ms: durationMs400, ip: server.requestIP(req)?.address ?? undefined,
                  feature: feature.name, request_id: requestId,
                  user_agent: req.headers.get('user-agent') ?? undefined,
                })
              } catch {}
            }
            return Response.json(
              { status: 400, message: 'Invalid JSON body', meta: { request_id: requestId, duration_ms: durationMs400 } },
              { status: 400 },
            )
          }
        }

        // Path params
        Object.assign(input, params)

        // Validate
        const errors = validateInput(feature.input, input)
        if (Object.keys(errors).length > 0) {
          const durationMs = Math.round((performance.now() - start) * 100) / 100
          if (sparkEnabled) {
            try {
              sparkDb.logAccess({
                timestamp: new Date().toISOString(), method, path: pathname, status: 422,
                duration_ms: durationMs, ip: server.requestIP(req)?.address ?? undefined,
                feature: feature.name, request_id: requestId, input: JSON.stringify(input),
                user_agent: req.headers.get('user-agent') ?? undefined,
              })
            } catch {}
          }
          return Response.json(
            {
              status: 422,
              message: 'Validation failed',
              errors,
              meta: { feature: feature.name, request_id: requestId, duration_ms: durationMs },
            },
            { status: 422 },
          )
        }

        // Stream features return SSE responses
        if (feature.type === 'stream') {
          const stream = new ReadableStream({
            async start(controller) {
              let closed = false

              const safeEnqueue = (chunk: string) => {
                if (closed) return
                try {
                  controller.enqueue(textEncoder.encode(chunk))
                } catch {
                  closed = true
                }
              }

              const emit: import('./feature').EmitFn = (...args: unknown[]) => {
                if (args.length === 1) {
                  const data = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])
                  safeEnqueue(`data: ${data}\n\n`)
                } else {
                  const event = args[0] as string
                  const data = typeof args[1] === 'string' ? args[1] : JSON.stringify(args[1])
                  safeEnqueue(`event: ${event}\ndata: ${data}\n\n`)
                }
              }

              const close = () => {
                if (closed) return
                closed = true
                try { controller.close() } catch {}
              }

              const fail = (message: string) => {
                safeEnqueue(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
                close()
              }

              // Initial meta event
              safeEnqueue(`event: meta\ndata: ${JSON.stringify({ feature: feature.name, request_id: requestId })}\n\n`)

              try {
                await feature.stream({ input, emit, close, fail })
                close()
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Internal server error'
                fail(message)
                if (sparkWatchErrors) {
                  try {
                    sparkDb.logEvent({
                      type: 'server-error',
                      traceId: requestId,
                      feature: feature.name,
                      route: `${method} ${pathname}`,
                      status: 500,
                      error: {
                        message: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined,
                      },
                      request: { input },
                    })
                  } catch {}
                }
              }
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          })
        }

        // Execute request features
        const helpers = createResultHelpers()
        const result = await feature.handle({ input, ok: helpers.ok, fail: helpers.fail })
        const durationMs = Math.round((performance.now() - start) * 100) / 100
        const envelope = toEnvelope(result, { featureName: feature.name, requestId, durationMs })

        if (sparkEnabled) {
          try {
            sparkDb.logAccess({
              timestamp: new Date().toISOString(), method, path: pathname, status: result.status,
              duration_ms: durationMs, ip: server.requestIP(req)?.address ?? undefined,
              feature: feature.name, request_id: requestId, input: JSON.stringify(input),
              error: result.status >= 500 ? (result as any).message : undefined,
              user_agent: req.headers.get('user-agent') ?? undefined,
            })
          } catch {}
        }

        return Response.json(envelope, { status: result.status })
      } catch (err) {
        const durationMs = Math.round((performance.now() - start) * 100) / 100
        if (sparkEnabled) {
          try {
            const errorMsg = err instanceof Error ? err.message : String(err)
            sparkDb.logAccess({
              timestamp: new Date().toISOString(), method, path: pathname, status: 500,
              duration_ms: durationMs, ip: server.requestIP(req)?.address ?? undefined,
              feature: feature.name, request_id: requestId, input: JSON.stringify(input),
              error: errorMsg, user_agent: req.headers.get('user-agent') ?? undefined,
            })
            if (sparkWatchErrors) {
              sparkDb.logEvent({
                type: 'server-error',
                traceId: requestId,
                feature: feature.name,
                route: `${method} ${pathname}`,
                status: 500,
                error: {
                  message: errorMsg,
                  stack: err instanceof Error ? err.stack : undefined,
                },
                request: { input },
              })
            }
          } catch {}
        }
        return Response.json(
          {
            status: 500,
            message: 'Internal server error',
            meta: { feature: feature.name, request_id: requestId, duration_ms: durationMs },
          },
          { status: 500 },
        )
      }
    },
  })
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE' || err?.message?.includes('address already in use') || err?.errno === -48) {
      console.error(`\n⚠ Port ${requestedPort} is already in use.`)
      console.error(`  Check what's using it: lsof -i :${requestedPort}`)
      console.error(`  Or use a different port: PORT=${requestedPort + 1} bun --hot index.ts\n`)
      process.exit(1)
    }
    throw err
  }

  const notifyReload = () => {
    for (const client of reloadClients) {
      try {
        client.enqueue('event: reload\ndata: reload\n\n')
      } catch {
        reloadClients.delete(client)
      }
    }
  }

  // In dev mode, watch frontend/ and trigger live reload automatically.
  // This makes dev mode single-process: just `bun --hot index.ts`.
  if (manifestConfig.debug && frontendConfig.devReload) {
    const frontendDir = path.resolve(options.projectDir, 'frontend')
    if (fs.existsSync(frontendDir)) {
      watchFrontend(options.projectDir, notifyReload)
    }
  }

  return {
    port: server.port,
    stop() {
      server.stop()
    },
    notifyReload,
  }
}
