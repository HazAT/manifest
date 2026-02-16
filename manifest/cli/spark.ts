import fs from 'fs/promises'
import path from 'path'

export const meta = [
  {
    name: 'spark init',
    description: 'Initialize Spark sidekick (config, Pi extension, .gitignore)',
    usage: 'bun manifest spark init',
  },
  {
    name: 'spark pause',
    description: 'Pause Spark event processing (use when making changes)',
    usage: 'bun manifest spark pause [reason]',
  },
  {
    name: 'spark resume',
    description: 'Resume Spark event processing',
    usage: 'bun manifest spark resume',
  },
  {
    name: 'spark status',
    description: 'Show current Spark status (enabled, environment, paused, events)',
    usage: 'bun manifest spark status',
  },
]

const CONFIG_PATH = 'config/spark.ts'
const PI_SETTINGS_PATH = '.pi/settings.json'
const GITIGNORE_PATH = '.gitignore'
const SPARK_EXTENSION_REF = '../extensions/spark/pi-extension'

const CONFIG_TEMPLATE = `/**
 * Spark sidekick configuration.
 * Controls the reactive AI sidekick that watches your app for errors
 * and can investigate or fix issues depending on the environment.
 */
export default {
  // Master switch — set to false to disable all Spark behavior
  enabled: true,

  // Current environment — controls tool access and behavior mode
  environment: (Bun.env.SPARK_ENV || Bun.env.NODE_ENV || 'development') as string,

  // Directory where event files are written (relative to project root)
  eventsDir: '.spark/events',

  // Which event types to capture and emit
  watch: {
    unhandledErrors: true,
    serverErrors: true,
  },

  // Per-environment behavior profiles
  environments: {
    development: {
      tools: 'full' as const,     // All coding tools available
      behavior: 'fix' as const,   // Investigate and apply fixes
    },
    production: {
      tools: 'readonly' as const, // Read-only tools only
      behavior: 'alert' as const, // Report issues, don't modify code
    },
  },

  // Pause protocol — stale pause files older than this trigger doctor mode
  pause: {
    staleThresholdMinutes: 30,
  },

  // Event debouncing — batch rapid events within this window
  debounce: {
    windowMs: 1000,
  },
}
`

/** Initialize Spark: create config, register Pi extension, update .gitignore, output guidance. */
export async function sparkInit(_args: string[]): Promise<void> {
  const steps: string[] = []

  // 1. Create config/spark.ts if not present
  try {
    await fs.access(CONFIG_PATH)
    steps.push('✓ config/spark.ts already exists')
  } catch {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
    await fs.writeFile(CONFIG_PATH, CONFIG_TEMPLATE)
    steps.push('✓ Created config/spark.ts')
  }

  // 2. Add Pi extension to .pi/settings.json
  let settings: Record<string, unknown> = {}
  try {
    const raw = await fs.readFile(PI_SETTINGS_PATH, 'utf-8')
    settings = JSON.parse(raw)
  } catch {}

  const extensions: string[] = Array.isArray(settings.extensions) ? settings.extensions : []
  if (!extensions.includes(SPARK_EXTENSION_REF)) {
    extensions.push(SPARK_EXTENSION_REF)
    settings.extensions = extensions
    await fs.mkdir(path.dirname(PI_SETTINGS_PATH), { recursive: true })
    await fs.writeFile(PI_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n')
    steps.push('✓ Added Spark Pi extension to .pi/settings.json')
  } else {
    steps.push('✓ Pi extension already registered in .pi/settings.json')
  }

  // 3. Add .spark/ to .gitignore
  let gitignore = ''
  try {
    gitignore = await fs.readFile(GITIGNORE_PATH, 'utf-8')
  } catch {}

  if (!gitignore.split('\n').some((line) => line.trim() === '.spark/' || line.trim() === '.spark')) {
    const entry = gitignore.endsWith('\n') || gitignore === '' ? '.spark/\n' : '\n.spark/\n'
    await fs.writeFile(GITIGNORE_PATH, gitignore + entry)
    steps.push('✓ Added .spark/ to .gitignore')
  } else {
    steps.push('✓ .spark/ already in .gitignore')
  }

  // 4. Check Pi installation — prefer local project dependency, fall back to global
  let piLocal = false
  let piGlobal = false
  try {
    await fs.access('node_modules/@mariozechner/pi-coding-agent/package.json')
    piLocal = true
  } catch {}
  if (!piLocal) {
    try {
      const proc = Bun.spawnSync(['which', 'pi'])
      piGlobal = proc.exitCode === 0
    } catch {}
  }

  // Output
  console.log('\n⚡ Spark initialized\n')
  for (const step of steps) {
    console.log(`  ${step}`)
  }

  console.log()
  if (piLocal) {
    console.log('  Pi is installed as a project dependency.')
    console.log('  Run `bunx pi` in this directory — Spark will auto-load.')
  } else if (piGlobal) {
    console.log('  Pi is installed globally. Run `pi` in this directory — Spark will auto-load.')
  } else {
    console.log('  Pi not found. Install it:')
    console.log('    bun add @mariozechner/pi-coding-agent    (project dependency — recommended)')
    console.log('    npm install -g @mariozechner/pi-coding-agent  (global install)')
    console.log('  You\'ll need an API key for your LLM provider (Anthropic, OpenAI, etc.).')
  }

  const piCmd = piLocal ? 'bunx pi' : 'pi'

  console.log(`
  Next steps:
    1. Start your app:       bun --hot index.ts
    2. Start Spark:          ${piCmd}
    3. Spark will auto-load and watch for events

  Verify it works: trigger a 500 error, then check .spark/events/
  Full docs: extensions/spark/EXTENSION.md
`)
}

/** Pause Spark with an optional reason. */
export async function sparkPause(args: string[]): Promise<void> {
  const reason = args.join(' ') || 'Paused via CLI'
  const { spark } = await import('../../extensions/spark/services/spark')
  await spark.pause(reason, 'cli')
  console.log(`⏸ Spark paused: ${reason}`)
}

/** Resume Spark event processing. */
export async function sparkResume(_args: string[]): Promise<void> {
  const { spark } = await import('../../extensions/spark/services/spark')
  await spark.resume()
  console.log('▶ Spark resumed')
}

/** Show current Spark status. */
export async function sparkStatus(_args: string[]): Promise<void> {
  const { spark } = await import('../../extensions/spark/services/spark')
  const status = await spark.status()

  // Check if Pi extension is registered
  let piExtensionInstalled = false
  try {
    const raw = await fs.readFile(PI_SETTINGS_PATH, 'utf-8')
    const settings = JSON.parse(raw)
    piExtensionInstalled = Array.isArray(settings.extensions) && settings.extensions.includes(SPARK_EXTENSION_REF)
  } catch {}

  console.log('\n⚡ Spark Status\n')
  console.log(`  Enabled:          ${status.enabled ? 'yes' : 'no'}`)
  console.log(`  Environment:      ${status.environment}`)
  console.log(`  Paused:           ${status.paused ? `yes — ${status.pauseInfo?.reason || 'no reason'}` : 'no'}`)
  console.log(`  Pending events:   ${status.pendingEvents}`)
  console.log(`  Pi extension:     ${piExtensionInstalled ? 'registered' : 'not registered (run: bun manifest spark init)'}`)
  console.log()
}
