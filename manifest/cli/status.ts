/**
 * Quick health check combining check + learn + doctor into a single pulse.
 *
 * Usage: bun manifest status
 *
 * This is the first command an agent should run when arriving at a Manifest
 * project. It gives a fast overview of project health without the full
 * depth of check, learn, or doctor individually.
 */

import { scanAllFeatures } from '../scanner'
import path from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'

export const meta = {
  name: 'status',
  description: 'Quick project health check — the first command to run when arriving at a codebase',
  usage: 'bun manifest status',
}

export async function status(_args: string[]): Promise<number> {
  const projectDir = process.cwd()
  const issues: string[] = []
  const warnings: string[] = []
  const info: string[] = []

  console.log('')
  console.log('  \x1b[1mManifest Status\x1b[0m')
  console.log('')

  // ── Project overview ──
  const projectName = path.basename(projectDir)
  console.log(`  \x1b[1m── ${projectName} ──\x1b[0m`)
  console.log('')

  // Features
  let featureCount = 0
  let extensionCount = 0
  let schemaCount = 0
  let serviceCount = 0

  try {
    const registry = await scanAllFeatures(projectDir)
    featureCount = Object.keys(registry).length
  } catch (e) {
    issues.push(`Failed to scan features: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Extensions
  const extensionsDir = path.join(projectDir, 'extensions')
  if (existsSync(extensionsDir)) {
    try {
      extensionCount = readdirSync(extensionsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink()).length
    } catch {}
  }

  // Schemas
  const schemasDir = path.join(projectDir, 'schemas')
  if (existsSync(schemasDir)) {
    try {
      schemaCount = readdirSync(schemasDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).length
    } catch {}
  }

  // Services
  const servicesDir = path.join(projectDir, 'services')
  if (existsSync(servicesDir)) {
    try {
      serviceCount = readdirSync(servicesDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).length
    } catch {}
  }

  console.log(`  Features:    ${featureCount}`)
  console.log(`  Extensions:  ${extensionCount}`)
  console.log(`  Schemas:     ${schemaCount}`)
  console.log(`  Services:    ${serviceCount}`)
  console.log('')

  // ── System health ──
  console.log('  \x1b[1m── Health ──\x1b[0m')
  console.log('')

  // Bun
  try {
    console.log(`  \x1b[32m✓\x1b[0m Bun ${Bun.version}`)
  } catch {
    issues.push('Bun runtime not detected')
  }

  // MANIFEST.md
  if (existsSync(path.join(projectDir, 'MANIFEST.md'))) {
    console.log('  \x1b[32m✓\x1b[0m MANIFEST.md exists')
  } else {
    issues.push('MANIFEST.md missing → run `bun manifest index`')
  }

  // node_modules
  if (existsSync(path.join(projectDir, 'node_modules'))) {
    console.log('  \x1b[32m✓\x1b[0m Dependencies installed')
  } else {
    issues.push('node_modules/ missing → run `bun install`')
  }

  // index.ts
  if (existsSync(path.join(projectDir, 'index.ts'))) {
    console.log('  \x1b[32m✓\x1b[0m Entry point exists')
  } else {
    issues.push('index.ts missing — no server entry point')
  }

  // Frontend
  const frontendDir = path.join(projectDir, 'frontend')
  if (existsSync(frontendDir)) {
    const distDir = path.join(projectDir, 'dist')
    if (existsSync(distDir)) {
      console.log('  \x1b[32m✓\x1b[0m Frontend built (dist/ exists)')
    } else {
      warnings.push('frontend/ exists but dist/ is missing → run `bun manifest frontend build`')
    }
  }

  // ── Convention check (lightweight) ──
  try {
    const registry = await scanAllFeatures(projectDir)
    const features = Object.entries(registry)
    let conventionIssues = 0

    for (const [name, feature] of features) {
      if (!feature.description || feature.description.trim().length === 0) conventionIssues++
      if (!feature.sideEffects) conventionIssues++
      for (const [, fieldDef] of Object.entries(feature.input)) {
        if (!fieldDef.description || fieldDef.description.trim().length === 0) conventionIssues++
      }
    }

    if (conventionIssues === 0) {
      console.log('  \x1b[32m✓\x1b[0m Conventions pass')
    } else {
      warnings.push(`${conventionIssues} convention issue(s) → run \`bun manifest check\` for details`)
    }
  } catch {}

  // ── Staleness check (lightweight) ──
  // Check if MANIFEST.md lists the right features
  try {
    const manifestContent = readFileSync(path.join(projectDir, 'MANIFEST.md'), 'utf-8')
    const registry = await scanAllFeatures(projectDir)
    const featureNames = Object.keys(registry)
    let stale = false

    for (const name of featureNames) {
      if (!manifestContent.includes(name)) { stale = true; break }
    }

    if (stale) {
      warnings.push('MANIFEST.md is out of date → run `bun manifest index`')
    } else {
      console.log('  \x1b[32m✓\x1b[0m MANIFEST.md is current')
    }
  } catch {}

  // ── Spark status ──
  const sparkConfigPath = path.join(projectDir, 'config/spark.ts')
  if (existsSync(sparkConfigPath)) {
    const pausePath = path.join(projectDir, '.spark', 'pause')
    const eventsDir = path.join(projectDir, '.spark', 'events')

    let pendingEvents = 0
    if (existsSync(eventsDir)) {
      try {
        pendingEvents = readdirSync(eventsDir).filter(f => f.endsWith('.json')).length
      } catch {}
    }

    const paused = existsSync(pausePath)

    if (paused) {
      try {
        const pauseContent = readFileSync(pausePath, 'utf-8')
        const pauseData = JSON.parse(pauseContent)
        warnings.push(`Spark is paused: ${pauseData.reason || 'no reason'}`)
      } catch {
        warnings.push('Spark is paused')
      }
    } else {
      console.log('  \x1b[32m✓\x1b[0m Spark active')
    }

    if (pendingEvents > 0) {
      warnings.push(`${pendingEvents} pending Spark event(s) in .spark/events/`)
    }
  }

  // ── Recent process logs ──
  const logsDir = path.join(projectDir, '.spark', 'logs')
  if (existsSync(logsDir)) {
    try {
      const recentFailures = readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({ name: f, mtime: statSync(path.join(logsDir, f)).mtimeMs }))
        .filter(f => Date.now() - f.mtime < 60 * 60 * 1000) // last hour
        .sort((a, b) => b.mtime - a.mtime)

      if (recentFailures.length > 0) {
        info.push(`${recentFailures.length} process log(s) from the last hour in .spark/logs/`)
      }
    } catch {}
  }

  // ── Git status ──
  try {
    const proc = Bun.spawnSync({
      cmd: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const branch = proc.stdout.toString().trim()
    if (branch) {
      const statusProc = Bun.spawnSync({
        cmd: ['git', 'status', '--porcelain'],
        cwd: projectDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const changes = statusProc.stdout.toString().trim().split('\n').filter(Boolean).length
      const gitLine = changes > 0 ? `on \x1b[33m${branch}\x1b[0m (${changes} uncommitted change${changes === 1 ? '' : 's'})` : `on \x1b[32m${branch}\x1b[0m (clean)`
      console.log(`  \x1b[32m✓\x1b[0m Git ${gitLine}`)
    }
  } catch {}

  // ── Print issues and warnings ──
  if (issues.length > 0 || warnings.length > 0 || info.length > 0) {
    console.log('')
  }

  for (const issue of issues) {
    console.log(`  \x1b[31m✗\x1b[0m ${issue}`)
  }
  for (const warning of warnings) {
    console.log(`  \x1b[33m⚠\x1b[0m ${warning}`)
  }
  for (const i of info) {
    console.log(`  \x1b[36mℹ\x1b[0m ${i}`)
  }

  // ── Summary ──
  console.log('')
  if (issues.length === 0 && warnings.length === 0) {
    console.log('  Everything looks good. Ready to work.')
  } else if (issues.length > 0) {
    console.log(`  ${issues.length} issue(s) need attention. Run \`bun manifest doctor\` for full diagnostics.`)
  } else {
    console.log(`  ${warnings.length} warning(s). Run \`bun manifest check\` or \`bun manifest learn\` for details.`)
  }

  // ── Quick reference ──
  console.log('')
  console.log('  \x1b[2mDeeper checks:  bun manifest check | learn | doctor\x1b[0m')
  console.log('')

  return issues.length > 0 ? 1 : 0
}
