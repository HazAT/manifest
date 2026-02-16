export {}

/**
 * Manifest CLI entry point.
 *
 * This CLI is intentionally simple. No commander.js, no yargs.
 * Just process.argv parsing. Every command exports a `meta` object
 * (or array of objects) with name, description, and usage — used for
 * help text and MANIFEST.md generation.
 */

import type { CommandMeta } from './meta'

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  // Dynamic help from command metadata
  const { getAllCommandMeta } = await import('./meta')
  const commands = getAllCommandMeta()

  // Group commands by category
  const categories: Record<string, CommandMeta[]> = {
    'Quick Start': [],
    'Validation & Diagnostics': [],
    'Scaffolding (Agent Prompts)': [],
    'Frontend': [],
    'Process Runner': [],
    'Spark Sidekick': [],
  }

  for (const cmd of commands) {
    if (['status', 'serve'].includes(cmd.name)) categories['Quick Start']!.push(cmd)
    else if (['check', 'index', 'learn', 'doctor'].includes(cmd.name)) categories['Validation & Diagnostics']!.push(cmd)
    else if (cmd.name.startsWith('feature') || cmd.name.startsWith('extension')) categories['Scaffolding (Agent Prompts)']!.push(cmd)
    else if (cmd.name.startsWith('frontend')) categories['Frontend']!.push(cmd)
    else if (cmd.name === 'run') categories['Process Runner']!.push(cmd)
    else if (cmd.name.startsWith('spark')) categories['Spark Sidekick']!.push(cmd)
  }

  console.log('\nManifest CLI — Production is our dev environment.\n')

  for (const [category, cmds] of Object.entries(categories)) {
    if (cmds.length === 0) continue
    console.log(`  \x1b[1m${category}\x1b[0m`)
    const maxUsage = Math.max(...cmds.map(c => c.usage.length))
    for (const cmd of cmds) {
      console.log(`    ${cmd.usage.padEnd(maxUsage + 2)} ${cmd.description}`)
    }
    console.log('')
  }

  console.log('  \x1b[2mAliases: bun manifest make:feature <Name> → feature make\x1b[0m\n')
  process.exit(0)
}

switch (command) {
  case 'status': {
    const { status } = await import('./status')
    const exitCode = await status(args.slice(1))
    process.exit(exitCode)
    break
  }
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
