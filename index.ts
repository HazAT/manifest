import { createManifestServer } from './manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
console.log(`   Production is our dev environment.`)

// Spark Web UI: spawn sidecar process if enabled
try {
  const sparkConfig = (await import('./config/spark')).default
  if (sparkConfig.web?.enabled && sparkConfig.web.token) {
    Bun.spawn(['bun', 'run', './extensions/spark-web/services/sparkWeb.ts'], {
      cwd: import.meta.dir,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  }
} catch (err) {
  console.warn('⚡ Spark sidecar failed to start:', err)
}

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
