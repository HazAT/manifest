import { createManifestServer } from './manifest'
import sparkConfig from './config/spark'
import { sparkDb } from './services/sparkDb'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
console.log(`   Production is our dev environment.`)

// Spark: emit events for unhandled errors via sparkDb
try {
  if (sparkConfig.enabled && sparkConfig.watch.unhandledErrors) {
    let isEmitting = false
    const emitError = (error: Error) => {
      if (isEmitting) return // Prevent infinite loop: emit failure → unhandledRejection → emit
      isEmitting = true
      try {
        sparkDb.logEvent({
          type: 'unhandled-error',
          traceId: Bun.randomUUIDv7(),
          error: { message: error.message, stack: error.stack },
        })
      } catch {} finally { isEmitting = false }
    }

    process.on('uncaughtException', (error) => {
      try { emitError(error) } catch {}
    })

    process.on('unhandledRejection', (reason) => {
      try { emitError(reason instanceof Error ? reason : new Error(String(reason))) } catch {}
    })
  }

  // Start periodic cleanup
  if (sparkConfig.enabled) {
    setInterval(() => {
      try { sparkDb.cleanup() } catch {}
    }, sparkConfig.db.cleanup.intervalMs)
  }
} catch {} // Spark setup must never prevent server from starting
