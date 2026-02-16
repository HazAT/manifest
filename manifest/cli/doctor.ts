/**
 * Diagnose common issues across the entire Manifest application.
 *
 * Usage: bun manifest doctor
 *
 * Runs system-level checks (runtime, config, features, build) and collects
 * extension-specific troubleshooting guidance. This is the first command
 * an agent should run when something breaks — before guessing.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

export const meta = {
  name: 'doctor',
  description: 'Diagnose system issues, check extensions, show debugging guidance',
  usage: 'bun manifest doctor',
}

interface ExtensionDiagnostic {
  name: string
  troubleshooting: string
}

function extractTroubleshooting(content: string): string | null {
  const lines = content.split('\n')
  let capturing = false
  let captured: string[] = []

  for (const line of lines) {
    if (/^## Troubleshooting\b/i.test(line)) {
      capturing = true
      continue
    }
    if (capturing && /^## /.test(line)) {
      break
    }
    if (capturing) {
      captured.push(line)
    }
  }

  const text = captured.join('\n').trim()
  return text.length > 0 ? text : null
}

export async function doctor(_args: string[]): Promise<number> {
  const projectDir = process.cwd()
  const issues: string[] = []
  const passes: string[] = []

  // ── Runtime ──
  try {
    const bunVersion = Bun.version
    passes.push(`Bun ${bunVersion} detected.`)
  } catch {
    issues.push('Bun runtime not detected. Manifest requires Bun. Install: https://bun.sh')
  }

  // ── Config files ──
  const configs = ['config/manifest.ts']
  for (const cfg of configs) {
    const cfgPath = join(projectDir, cfg)
    if (existsSync(cfgPath)) {
      passes.push(`${cfg} exists.`)
    } else {
      issues.push(`${cfg} is missing. The server needs this file to start. Create it following the pattern in AGENTS.md.`)
    }
  }

  // ── Frontend config (only if frontend/ exists) ──
  const frontendDir = join(projectDir, 'frontend')
  if (existsSync(frontendDir)) {
    const frontendCfg = join(projectDir, 'config/frontend.ts')
    if (existsSync(frontendCfg)) {
      passes.push('config/frontend.ts exists.')

      // Check entry point
      try {
        const mod = await import(resolve(frontendCfg))
        const cfg = mod.default
        if (cfg?.entryPoint) {
          const entryPath = join(projectDir, cfg.entryPoint)
          if (existsSync(entryPath)) {
            passes.push(`Frontend entry point ${cfg.entryPoint} exists.`)
          } else {
            issues.push(`Frontend entry point ${cfg.entryPoint} does not exist. The build will fail. Create the file or update config/frontend.ts.`)
          }
        }
      } catch (e) {
        issues.push(`config/frontend.ts failed to load: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      issues.push('frontend/ directory exists but config/frontend.ts is missing. The server won\'t know how to build. Create config/frontend.ts.')
    }

    // Check dist/ freshness
    const distDir = join(projectDir, 'dist')
    if (!existsSync(distDir)) {
      issues.push('dist/ directory does not exist. Run `bun manifest frontend build` to generate it.')
    }
  }

  // ── Features ──
  const featuresDir = join(projectDir, 'features')
  if (existsSync(featuresDir)) {
    const featureFiles = readdirSync(featuresDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    if (featureFiles.length === 0) {
      issues.push('features/ directory exists but contains no .ts files. The API has no endpoints.')
    } else {
      passes.push(`${featureFiles.length} feature file(s) found.`)

      // Try to load features and catch import errors
      for (const file of featureFiles) {
        const fullPath = resolve(featuresDir, file)
        try {
          const mod = await import(fullPath)
          if (!mod.default || !mod.default.name) {
            issues.push(`features/${file} does not export a valid feature (missing default export or name). Use defineFeature().`)
          }
        } catch (e) {
          issues.push(`features/${file} failed to import: ${e instanceof Error ? e.message : String(e)}. Fix the syntax or import error.`)
        }
      }
    }
  } else {
    issues.push('features/ directory does not exist. There are no API endpoints. Create features/ and add a feature.')
  }

  // ── Dependencies ──
  const nodeModules = join(projectDir, 'node_modules')
  if (!existsSync(nodeModules)) {
    issues.push('node_modules/ does not exist. Run `bun install` to install dependencies.')
  }

  const packageJson = join(projectDir, 'package.json')
  if (!existsSync(packageJson)) {
    issues.push('package.json does not exist. Run `bun init` or create it manually.')
  }

  // ── MANIFEST.md ──
  if (existsSync(join(projectDir, 'MANIFEST.md'))) {
    passes.push('MANIFEST.md exists.')
  } else {
    issues.push('MANIFEST.md does not exist. Run `bun manifest index` to generate it.')
  }

  // ── TypeScript config ──
  const tsconfig = join(projectDir, 'tsconfig.json')
  if (existsSync(tsconfig)) {
    passes.push('tsconfig.json exists.')
    try {
      const content = readFileSync(tsconfig, 'utf-8')
      const parsed = JSON.parse(content)
      const jsx = parsed?.compilerOptions?.jsx
      const jsxImportSource = parsed?.compilerOptions?.jsxImportSource

      // If frontend/ has .tsx files, check JSX config
      if (existsSync(frontendDir)) {
        const hasTsx = readdirSync(frontendDir).some(f => f.endsWith('.tsx'))
        if (hasTsx && (!jsx || !jsxImportSource)) {
          issues.push('frontend/ contains .tsx files but tsconfig.json is missing jsx/jsxImportSource. Add "jsx": "preserve" and "jsxImportSource": "solid-js" (or your framework) to compilerOptions.')
        }
      }
    } catch {}
  } else {
    issues.push('tsconfig.json does not exist. TypeScript features may not work correctly.')
  }

  // ── Index.ts entry point ──
  if (existsSync(join(projectDir, 'index.ts'))) {
    passes.push('index.ts entry point exists.')
  } else {
    issues.push('index.ts does not exist. The server has no entry point.')
  }

  // ── Print system diagnostics ──
  console.log('')
  console.log('  \x1b[1m── System ──\x1b[0m')
  console.log('')

  for (const pass of passes) {
    console.log(`  \x1b[32m✓\x1b[0m ${pass}`)
  }
  for (const issue of issues) {
    console.log(`  \x1b[31m✗\x1b[0m ${issue}`)
  }

  if (issues.length === 0) {
    console.log('')
    console.log('  All system checks passed.')
  } else {
    console.log('')
    console.log(`  ${issues.length} system issue(s) found. Fix them and run \`bun manifest doctor\` again.`)
  }

  // ── Extension troubleshooting ──
  const extensionsDir = join(projectDir, 'extensions')
  const diagnostics: ExtensionDiagnostic[] = []
  const missing: string[] = []

  if (existsSync(extensionsDir)) {
    let entries: string[]
    try {
      entries = readdirSync(extensionsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink())
        .map(d => d.name)
    } catch {
      entries = []
    }

    for (const entry of entries) {
      const mdPath = join(extensionsDir, entry, 'EXTENSION.md')
      if (!existsSync(mdPath)) continue

      try {
        const content = readFileSync(mdPath, 'utf-8')
        const troubleshooting = extractTroubleshooting(content)
        if (troubleshooting) {
          diagnostics.push({ name: entry, troubleshooting })
        } else {
          missing.push(entry)
        }
      } catch {}
    }
  }

  if (diagnostics.length > 0) {
    console.log('')
    console.log('  \x1b[1m── Extension Diagnostics ──\x1b[0m')
    console.log('')
    console.log('  If the issue is extension-specific, check these:')
    console.log('')

    for (const diag of diagnostics) {
      console.log(`  \x1b[36m── ${diag.name} ──\x1b[0m`)
      for (const line of diag.troubleshooting.split('\n')) {
        console.log(`  ${line}`)
      }
      console.log('')
    }
  }

  if (missing.length > 0) {
    console.log(`  \x1b[33m⚠ Extensions without troubleshooting guidance:\x1b[0m`)
    for (const name of missing) {
      console.log(`    - ${name} → Add a \`## Troubleshooting\` section to extensions/${name}/EXTENSION.md`)
    }
    console.log('')
  }

  // ── Process runner logs ──
  const logsDir = join(projectDir, '.spark', 'logs')
  if (existsSync(logsDir)) {
    try {
      const logFiles = readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({ name: f, mtime: statSync(join(logsDir, f)).mtimeMs }))
        .filter(f => Date.now() - f.mtime < 60 * 60 * 1000) // last hour
        .sort((a, b) => b.mtime - a.mtime)

      if (logFiles.length > 0) {
        console.log('')
        console.log('  \x1b[1m── Recent Process Logs ──\x1b[0m')
        console.log('')
        for (const f of logFiles.slice(0, 10)) {
          const age = Math.round((Date.now() - f.mtime) / 60000)
          console.log(`  \x1b[36m•\x1b[0m .spark/logs/${f.name} (${age}m ago)`)
        }
        console.log('')
        console.log('  Read a log file to see full process output.')
        console.log('')
      }
    } catch {}
  }

  // ── Debugging tips ──
  console.log('  \x1b[1m── Debugging Tips ──\x1b[0m')
  console.log('')
  console.log('  • Server won\'t start? → Read the error. Check config/manifest.ts and index.ts.')
  console.log('  • Feature returns 500? → The error is caught in manifest/server.ts. Add console.error in the catch block to see the real error.')
  console.log('  • Feature not found (404)? → Run `bun manifest index` and check MANIFEST.md for the route. Verify the feature file exports a default defineFeature().')
  console.log('  • Validation fails unexpectedly (422)? → Check the feature\'s input schema. Query params arrive as strings — use t.integer() or t.number() carefully with GET requests.')
  console.log('  • Import errors on startup? → A feature or service has a bad import. Run `bun run features/<File>.ts` directly to see the error.')
  console.log('  • Frontend serves stale content? → Run `bun manifest frontend build`. Check that dist/ was updated. Hard-refresh the browser.')
  console.log('  • Database connection fails? → Check your DATABASE_URL environment variable. Verify the database is running: `pg_isready -h <host> -p <port>`.')
  console.log('  • Need to see all registered routes? → Run `bun manifest index` and read the Feature Index table in MANIFEST.md.')
  console.log('')

  return issues.length > 0 ? 1 : 0
}
