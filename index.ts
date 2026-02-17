import { createManifestServer } from './manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
console.log(`   Production is our dev environment.`)

// Spark: resolve once at startup, emit events for unhandled errors
try {
  const sparkConfig = (await import('./config/spark')).default
  if (sparkConfig.enabled && sparkConfig.watch.unhandledErrors) {
    const { spark } = await import('./extensions/spark/services/spark')
    let isEmitting = false
    const emitError = (error: Error) => {
      if (isEmitting) return // Prevent infinite loop: emit failure → unhandledRejection → emit
      isEmitting = true
      spark.emit({
        type: 'unhandled-error',
        traceId: Bun.randomUUIDv7(),
        error: { message: error.message, stack: error.stack },
      }).catch(() => {}).finally(() => { isEmitting = false })
    }

    process.on('uncaughtException', (error) => {
      try { emitError(error) } catch {}
    })

    process.on('unhandledRejection', (reason) => {
      try { emitError(reason instanceof Error ? reason : new Error(String(reason))) } catch {}
    })
  }
} catch {} // Spark setup must never prevent server from starting
