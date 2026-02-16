import { createManifestServer } from './manifest'

// Conditionally initialize Spark Web UI
let sparkWebHandler: { routes: any[]; websocket: any } | null = null
try {
  const sparkConfig = (await import('./config/spark')).default
  if (sparkConfig.web?.enabled) {
    if (!sparkConfig.web.token) {
      console.warn('⚡ Spark web UI enabled but no token set. Set SPARK_WEB_TOKEN or config.web.token. Web UI disabled.')
    } else {
      const { createSparkWeb } = await import('./extensions/spark-web/services/sparkWeb')
      sparkWebHandler = await createSparkWeb({
        enabled: sparkConfig.enabled,
        environment: sparkConfig.environment,
        eventsDir: sparkConfig.eventsDir,
        web: sparkConfig.web,
        projectDir: import.meta.dir,
      })
    }
  }
} catch (err) {
  console.warn('⚡ Spark web UI failed to initialize:', err)
}

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
  ...(sparkWebHandler ? { customRoutes: sparkWebHandler.routes, websocket: sparkWebHandler.websocket } : {}),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
if (sparkWebHandler) {
  const sparkConfig = (await import('./config/spark')).default
  console.log(`⚡ Spark web UI at http://localhost:${server.port}${sparkConfig.web.path}/`)
}
console.log(`   Production is our dev environment.`)

// Spark: resolve once at startup, emit events for unhandled errors
try {
  const sparkConfig = (await import('./config/spark')).default
  if (sparkConfig.enabled && sparkConfig.watch.unhandledErrors) {
    const { spark } = await import('./extensions/spark/services/spark')
    const emitError = (error: Error) => {
      spark.emit({
        type: 'unhandled-error',
        traceId: Bun.randomUUIDv7(),
        error: { message: error.message, stack: error.stack },
      })
    }

    process.on('uncaughtException', (error) => {
      try { emitError(error) } catch {}
    })

    process.on('unhandledRejection', (reason) => {
      try { emitError(reason instanceof Error ? reason : new Error(String(reason))) } catch {}
    })
  }
} catch {} // Spark setup must never prevent server from starting
