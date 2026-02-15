export {}

/**
 * Manifest CLI entry point.
 *
 * Usage:
 *   bun manifest/cli/index.ts serve
 *   bun manifest/cli/index.ts index
 *   bun manifest/cli/index.ts check
 *   bun manifest/cli/index.ts make:feature <Name>
 *
 * This CLI is intentionally simple. No commander.js, no yargs.
 * Just process.argv parsing.
 */

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  console.log(`
Manifest CLI - Production is our dev environment.

Usage:
  bun manifest serve [--port=8080]     Start the development server
  bun manifest index                    Rebuild MANIFEST.md
  bun manifest check                    Validate conventions
  bun manifest make:feature <Name>      Scaffold a new feature

`)
  process.exit(0)
}

switch (command) {
  case 'serve': {
    const { serve } = await import('./serve')
    await serve(args.slice(1))
    break
  }
  case 'index': {
    const { indexManifest } = await import('./indexManifest')
    await indexManifest(args.slice(1))
    break
  }
  case 'check': {
    const { check } = await import('./check')
    const exitCode = await check(args.slice(1))
    process.exit(exitCode)
    break
  }
  case 'make:feature': {
    const { makeFeature } = await import('./makeFeature')
    await makeFeature(args.slice(1))
    break
  }
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
