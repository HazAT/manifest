import { createManifestServer } from './manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
console.log(`   Production is our dev environment.`)

// Spark: emit events for unhandled errors
try {
  const sparkConfig = (await import('./config/spark')).default
  if (sparkConfig.enabled && sparkConfig.watch.unhandledErrors) {
    const { spark } = await import('./extensions/spark/services/spark')

    process.on('uncaughtException', (error) => {
      spark.emit({
        type: 'unhandled-error',
        traceId: crypto.randomUUID(),
        error: {
          message: error.message,
          stack: error.stack,
        },
      })
    })

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      spark.emit({
        type: 'unhandled-error',
        traceId: crypto.randomUUID(),
        error: {
          message: error.message,
          stack: error.stack,
        },
      })
    })
  }
} catch {} // Spark setup must never prevent server from starting
