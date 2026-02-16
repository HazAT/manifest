/**
 * Start the Manifest development server.
 * Usage: bun manifest serve [--port=8080]
 */

import { createManifestServer } from '../server'

export const meta = {
  name: 'serve',
  description: 'Start the development server',
  usage: 'bun manifest serve [--port=8080]',
}

export async function serve(args: string[]): Promise<void> {
  const projectDir = process.cwd()
  let port = 8080

  for (const arg of args) {
    if (arg.startsWith('--port=')) {
      port = parseInt(arg.slice(7), 10)
    }
  }

  const server = await createManifestServer({
    projectDir,
    port,
  })

  console.log(``)
  console.log(`  Manifest server running on http://localhost:${server.port}`)
  console.log(`  Production is our dev environment.`)
  console.log(``)
  console.log(`  Test endpoints with: curl http://localhost:${server.port}/api/hello`)
  console.log(``)
  console.log(`  Tip: Run with 'bun --hot' for live reload:`)
  console.log(`    bun --hot manifest/cli/index.ts serve`)
  console.log(``)
}
