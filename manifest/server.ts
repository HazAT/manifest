import path from 'path'
import { scanFeatures } from './scanner'
import { createRouter } from './router'
import { validateInput } from './validator'
import { toEnvelope, createResultHelpers } from './envelope'

interface ServerOptions {
  projectDir: string
  port?: number
}

export async function createManifestServer(options: ServerOptions) {
  const featuresDir = path.join(options.projectDir, 'features')
  const registry = await scanFeatures(featuresDir)
  const router = createRouter(registry)

  const server = Bun.serve({
    port: options.port ?? 3000,
    fetch: async (req) => {
      const url = new URL(req.url)
      const method = req.method
      const pathname = url.pathname

      // Try to match route
      const match = router.match(method, pathname)

      if (!match) {
        if (router.isMethodNotAllowed(method, pathname)) {
          return Response.json({ status: 405, message: 'Method not allowed' }, { status: 405 })
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
            // ignore parse errors
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

  return {
    port: server.port,
    stop() {
      server.stop()
    },
  }
}
