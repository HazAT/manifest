import { createManifestServer } from './manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: Number(Bun.env.PORT ?? 8080),
})

console.log(`🔧 Manifest server running on http://localhost:${server.port}`)
console.log(`   Production is our dev environment.`)
