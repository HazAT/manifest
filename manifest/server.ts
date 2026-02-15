import path from 'path'
import fs from 'fs'
import { scanAllFeatures } from './scanner'
import { createRouter } from './router'
import { validateInput } from './validator'
import { toEnvelope, createResultHelpers } from './envelope'
import { createStaticHandler, watchFrontend } from './frontend'
import frontendConfig from '../config/frontend'
import manifestConfig from '../config/manifest'

export interface ManifestServerOptions {
  projectDir: string
  port?: number
}

export type ManifestServer = Awaited<ReturnType<typeof createManifestServer>>

export async function createManifestServer(options: ManifestServerOptions) {
  const registry = await scanAllFeatures(options.projectDir)
  const router = createRouter(registry)

  // Static file serving (only if dist/ exists)
  const distDir = path.resolve(options.projectDir, frontendConfig.outputDir)
  const staticHandler = fs.existsSync(distDir)
    ? createStaticHandler(distDir, { spaFallback: frontendConfig.spaFallback })
    : null

  // Live reload SSE clients (dev mode only)
  const reloadClients = new Set<ReadableStreamDefaultController>()

  const server = Bun.serve({
    port: options.port ?? 3000,
    fetch: async (req) => {
      const url = new URL(req.url)
      const method = req.method
      const pathname = url.pathname

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

      // Try to match route
      const match = router.match(method, pathname)

      if (!match) {
        if (router.isMethodNotAllowed(method, pathname)) {
          return Response.json({ status: 405, message: 'Method not allowed' }, { status: 405 })
        }

        // Fallback to static files
        if (staticHandler) {
          const staticResponse = staticHandler(pathname)
          if (staticResponse) return staticResponse
        }

        return Response.json({ status: 404, message: 'Not found' }, { status: 404 })
      }

      const { feature, params } = match
      const requestId = crypto.randomUUID()
      const start = performance.now()

      try {
        // Parse input from query params + JSON body + path params
        const input: Record<string, unknown> = {}

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
            return Response.json(
              { status: 400, message: 'Invalid JSON body', meta: { request_id: requestId, duration_ms: Math.round(performance.now() - start) } },
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

        // Execute
        const helpers = createResultHelpers()
        const result = await feature.handle({ input, ok: helpers.ok, fail: helpers.fail })
        const durationMs = Math.round((performance.now() - start) * 100) / 100
        const envelope = toEnvelope(result, { featureName: feature.name, requestId, durationMs })

        return Response.json(envelope, { status: result.status })
      } catch (err) {
        const durationMs = Math.round((performance.now() - start) * 100) / 100
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
