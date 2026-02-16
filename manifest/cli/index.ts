export {}

/**
 * Manifest CLI entry point.
 *
 * Usage:
 *   bun manifest serve
 *   bun manifest index
 *   bun manifest check
 *   bun manifest learn
 *   bun manifest feature make <Name>
 *   bun manifest extension make|install|list
 *
 * Backward-compatible aliases:
 *   bun manifest make:feature <Name>
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
  bun manifest serve [--port=8080]           Start the development server
  bun manifest index                          Rebuild MANIFEST.md
  bun manifest check                          Validate conventions
  bun manifest learn                          Check for staleness after changes
  bun manifest doctor                         Diagnose issues using extension guidance

  bun manifest feature make <Name>            Scaffold a new feature
  bun manifest extension make <name>          Scaffold a new extension
  bun manifest extension install <url|name>   Install an extension
  bun manifest extension list                 List installed extensions

  bun manifest frontend install               Choose and install a frontend preset
  bun manifest frontend build                 Build frontend for production
  bun manifest frontend dev                   Start frontend dev watcher

  bun manifest run <command> [args...]         Run a command with logging + Spark

  bun manifest spark init                     Initialize Spark sidekick
  bun manifest spark pause [reason]           Pause event processing
  bun manifest spark resume                   Resume event processing
  bun manifest spark status                   Show Spark status

Aliases:
  bun manifest make:feature <Name>            Same as feature make

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
  case 'learn': {
    const { learn } = await import('./learn')
    const exitCode = await learn(args.slice(1))
    process.exit(exitCode)
    break
  }
  case 'doctor': {
    const { doctor } = await import('./doctor')
    const exitCode = await doctor(args.slice(1))
    process.exit(exitCode)
    break
  }
  case 'make:feature': {
    const { makeFeature } = await import('./makeFeature')
    await makeFeature(args.slice(1))
    break
  }
  case 'feature': {
    const subcommand = args[1]
    switch (subcommand) {
      case 'make': {
        const { makeFeature } = await import('./makeFeature')
        await makeFeature(args.slice(2))
        break
      }
      default:
        console.error(subcommand
          ? `Unknown feature subcommand: ${subcommand}`
          : 'Missing subcommand. Usage: bun manifest feature make <Name>')
        process.exit(1)
    }
    break
  }
  case 'frontend': {
    const subcommand = args[1]
    switch (subcommand) {
      case 'install': {
        const { frontendInstall } = await import('./frontend')
        await frontendInstall(args.slice(2))
        break
      }
      case 'build': {
        const { frontendBuild } = await import('./frontend')
        await frontendBuild(args.slice(2))
        break
      }
      case 'dev': {
        const { frontendDev } = await import('./frontend')
        await frontendDev(args.slice(2))
        break
      }
      default:
        console.error(subcommand
          ? `Unknown frontend subcommand: ${subcommand}`
          : 'Missing subcommand. Usage: bun manifest frontend install|build|dev')
        process.exit(1)
    }
    break
  }
  case 'spark': {
    const subcommand = args[1]
    switch (subcommand) {
      case 'init': {
        const { sparkInit } = await import('./spark')
        await sparkInit(args.slice(2))
        break
      }
      case 'pause': {
        const { sparkPause } = await import('./spark')
        await sparkPause(args.slice(2))
        break
      }
      case 'resume': {
        const { sparkResume } = await import('./spark')
        await sparkResume(args.slice(2))
        break
      }
      case 'status': {
        const { sparkStatus } = await import('./spark')
        await sparkStatus(args.slice(2))
        break
      }
      default:
        console.error(subcommand
          ? `Unknown spark subcommand: ${subcommand}`
          : 'Missing subcommand. Usage: bun manifest spark init|pause|resume|status')
        process.exit(1)
    }
    break
  }
  case 'run': {
    const { run: runCmd } = await import('./run')
    await runCmd(args.slice(1))
    break
  }
  case 'extension': {
    const subcommand = args[1]
    switch (subcommand) {
      case 'make': {
        const { makeExtension } = await import('./extension')
        await makeExtension(args.slice(2))
        break
      }
      case 'install': {
        const { installExtension } = await import('./extension')
        await installExtension(args.slice(2))
        break
      }
      case 'list': {
        const { listExtensions } = await import('./extension')
        await listExtensions(args.slice(2))
        break
      }
      default:
        console.error(subcommand
          ? `Unknown extension subcommand: ${subcommand}`
          : 'Missing subcommand. Usage: bun manifest extension make|install|list')
        process.exit(1)
    }
    break
  }
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
