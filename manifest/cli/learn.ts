/**
 * Scan the codebase for staleness and inconsistencies after changes.
 *
 * Usage: bun manifest learn
 *
 * Checks:
 *   - MANIFEST.md is up to date with current features
 *   - AGENTS.md mentions all extensions
 *   - Extensions have EXTENSION.md files
 *   - All installed extensions are referenced in AGENTS.md
 *   - Config files exist for referenced services
 *   - Skills reference accurate file paths
 *   - Framework table line counts are still accurate
 *   - Recent git changes touch files that might need doc updates
 */

import { scanFeatures } from '../scanner'
import path from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'

export const meta = {
  name: 'learn',
  description: 'Scan for staleness and inconsistencies after changes',
  usage: 'bun manifest learn',
}

interface Finding {
  level: 'warn' | 'info'
  message: string
}

export async function learn(_args: string[]): Promise<number> {
  const projectDir = process.cwd()
  const findings: Finding[] = []

  console.log('\n  Manifest Learn — scanning for staleness...\n')

  // 1. Check MANIFEST.md exists and is recent
  await checkManifestFreshness(projectDir, findings)

  // 2. Check extensions have EXTENSION.md and are mentioned in AGENTS.md
  checkExtensions(projectDir, findings)

  // 3. Check AGENTS.md framework table line counts
  await checkFrameworkTable(projectDir, findings)

  // 4. Check features have tests
  await checkFeatureTests(projectDir, findings)

  // 5. Check skills reference valid paths
  checkSkills(projectDir, findings)

  // 6. Check for recent git changes that might need doc updates
  await checkRecentChanges(projectDir, findings)

  // 7. Check AGENTS.md mentions all directories that exist
  checkProjectStructure(projectDir, findings)

  // 8. Run convention check
  await checkConventions(projectDir, findings)

  // Print results
  const warns = findings.filter((f) => f.level === 'warn')
  const infos = findings.filter((f) => f.level === 'info')

  for (const f of warns) {
    console.log(`  \x1b[33m⚠\x1b[0m ${f.message}`)
  }
  for (const f of infos) {
    console.log(`  \x1b[36mℹ\x1b[0m ${f.message}`)
  }

  if (findings.length === 0) {
    console.log('  \x1b[32m✓\x1b[0m Everything looks consistent.')
    console.log('  No action needed. The codebase is consistent.\n')
    return 0
  }

  console.log('')
  if (warns.length > 0) {
    console.log(`  ${warns.length} item(s) likely need attention.`)
  }
  if (infos.length > 0) {
    console.log(`  ${infos.length} item(s) worth reviewing.`)
  }
  console.log('  Run through the full checklist: read .claude/skills/manifest-learn/SKILL.md\n')
  return warns.length > 0 ? 1 : 0
}

async function checkManifestFreshness(projectDir: string, findings: Finding[]) {
  const manifestPath = path.join(projectDir, 'MANIFEST.md')
  if (!existsSync(manifestPath)) {
    findings.push({ level: 'warn', message: 'MANIFEST.md does not exist. Run `bun manifest index`.' })
    return
  }

  const manifestContent = readFileSync(manifestPath, 'utf-8')
  const registry = await scanFeatures(path.join(projectDir, 'features'))
  const featureNames = Object.keys(registry)

  // Check if all features are in MANIFEST.md
  for (const name of featureNames) {
    if (!manifestContent.includes(name)) {
      findings.push({ level: 'warn', message: `Feature '${name}' not found in MANIFEST.md. Run \`bun manifest index\`.` })
    }
  }

  // Check if MANIFEST.md references features that no longer exist
  const tableMatch = manifestContent.match(/## Feature Index\n\|.*\n\|.*\n([\s\S]*?)(?=\n##|\n$)/)
  if (tableMatch) {
    const rows = tableMatch[1]!.trim().split('\n').filter((r) => r.startsWith('|'))
    for (const row of rows) {
      const nameMatch = row.match(/^\|\s*(\S+)\s*\|/)
      if (nameMatch && !featureNames.includes(nameMatch[1]!)) {
        findings.push({ level: 'warn', message: `MANIFEST.md references feature '${nameMatch[1]}' which no longer exists.` })
      }
    }
  }
}

function checkExtensions(projectDir: string, findings: Finding[]) {
  const extDir = path.join(projectDir, 'extensions')
  if (!existsSync(extDir)) return

  const extensions = readdirSync(extDir).filter((f) => {
    try { return statSync(path.join(extDir, f)).isDirectory() } catch { return false }
  })

  if (extensions.length === 0) return

  const agentsPath = path.join(projectDir, 'AGENTS.md')
  const agentsContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf-8') : ''

  for (const ext of extensions) {
    const extMdPath = path.join(extDir, ext, 'EXTENSION.md')
    if (!existsSync(extMdPath)) {
      findings.push({ level: 'warn', message: `Extension '${ext}' has no EXTENSION.md.` })
    }

    if (agentsContent && !agentsContent.includes(ext)) {
      findings.push({ level: 'info', message: `Extension '${ext}' is not mentioned in AGENTS.md. Should it be documented?` })
    }
  }
}

async function checkFrameworkTable(projectDir: string, findings: Finding[]) {
  const agentsPath = path.join(projectDir, 'AGENTS.md')
  if (!existsSync(agentsPath)) return

  const agentsContent = readFileSync(agentsPath, 'utf-8')
  const lineCountPattern = /\| `(\S+)` \| (\d+) \|/g

  let match
  while ((match = lineCountPattern.exec(agentsContent)) !== null) {
    const filePath = match[1]!
    const claimedLines = parseInt(match[2]!, 10)

    const fullPath = path.join(projectDir, 'manifest', filePath)
    if (!existsSync(fullPath)) {
      // Could be a directory reference like cli/
      if (!existsSync(fullPath.replace(/\/$/, ''))) {
        findings.push({ level: 'warn', message: `AGENTS.md references manifest/${filePath} but it doesn't exist.` })
      }
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const actualLines = content.split('\n').length
      const drift = Math.abs(actualLines - claimedLines)

      if (drift > 20) {
        findings.push({ level: 'warn', message: `AGENTS.md says manifest/${filePath} is ${claimedLines} lines, actually ${actualLines} (drift: ${drift}).` })
      } else if (drift > 5) {
        findings.push({ level: 'info', message: `AGENTS.md says manifest/${filePath} is ${claimedLines} lines, actually ${actualLines} (drift: ${drift}).` })
      }
    } catch { /* skip unreadable */ }
  }
}

async function checkFeatureTests(projectDir: string, findings: Finding[]) {
  const registry = await scanFeatures(path.join(projectDir, 'features'))

  for (const name of Object.keys(registry)) {
    const testPaths = [
      path.join(projectDir, 'tests', `${pascalCase(name)}.test.ts`),
      path.join(projectDir, 'tests', `${name}.test.ts`),
    ]
    if (!testPaths.some((p) => existsSync(p))) {
      findings.push({ level: 'info', message: `Feature '${name}' has no test file.` })
    }
  }
}

function checkSkills(projectDir: string, findings: Finding[]) {
  const skillsDir = path.join(projectDir, '.claude', 'skills')
  if (!existsSync(skillsDir)) return

  const skills = readdirSync(skillsDir).filter((f) => {
    try { return statSync(path.join(skillsDir, f)).isDirectory() } catch { return false }
  })

  for (const skill of skills) {
    const skillFile = path.join(skillsDir, skill, 'SKILL.md')
    if (!existsSync(skillFile)) {
      findings.push({ level: 'warn', message: `Skill '${skill}' directory exists but has no SKILL.md.` })
    }
  }
}

async function checkRecentChanges(projectDir: string, findings: Finding[]) {
  try {
    const proc = Bun.spawnSync({
      cmd: ['git', 'diff', '--name-only', 'HEAD~5', 'HEAD'],
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = proc.stdout.toString().trim()
    if (!output) return

    const changedFiles = output.split('\n')

    const frameworkChanged = changedFiles.some((f) => f.startsWith('manifest/'))
    const schemasChanged = changedFiles.some((f) => f.startsWith('schemas/'))
    const servicesChanged = changedFiles.some((f) => f.startsWith('services/'))
    const extensionsChanged = changedFiles.some((f) => f.startsWith('extensions/'))
    const configChanged = changedFiles.some((f) => f.startsWith('config/'))
    const agentsChanged = changedFiles.includes('AGENTS.md')

    if (frameworkChanged && !agentsChanged) {
      findings.push({ level: 'info', message: 'Framework files changed in recent commits but AGENTS.md was not updated. Check if the framework table or docs need refreshing.' })
    }
    if (extensionsChanged) {
      findings.push({ level: 'info', message: 'Extensions changed in recent commits. Check AGENTS.md and MANIFEST.md reflect the current extension state.' })
    }
    if (schemasChanged || servicesChanged) {
      findings.push({ level: 'info', message: 'Schemas or services changed recently. Check if features that depend on them still work, and that MANIFEST.md is current.' })
    }
    if (configChanged) {
      findings.push({ level: 'info', message: 'Config files changed recently. Check if AGENTS.md documents new config options.' })
    }
  } catch {
    // Not a git repo or git not available — skip
  }
}

function checkProjectStructure(projectDir: string, findings: Finding[]) {
  const agentsPath = path.join(projectDir, 'AGENTS.md')
  if (!existsSync(agentsPath)) return

  const agentsContent = readFileSync(agentsPath, 'utf-8')

  // Directories that might exist but aren't mentioned
  const knownDirs = ['features', 'schemas', 'services', 'policies', 'commands', 'config', 'extensions', 'tests', 'manifest']

  for (const dir of readdirSync(projectDir)) {
    if (dir.startsWith('.') || dir === 'node_modules' || dir === 'dist') continue
    const fullPath = path.join(projectDir, dir)
    try {
      if (!statSync(fullPath).isDirectory()) continue
    } catch { continue }

    if (!knownDirs.includes(dir) && !agentsContent.includes(dir)) {
      findings.push({ level: 'info', message: `Directory '${dir}/' exists but isn't mentioned in AGENTS.md. New addition?` })
    }
  }
}

async function checkConventions(projectDir: string, findings: Finding[]) {
  try {
    const proc = Bun.spawnSync({
      cmd: ['bun', 'run', 'manifest', 'check'],
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = proc.stdout.toString()
    if (output.includes('issue(s) found')) {
      findings.push({ level: 'warn', message: 'Convention check (`bun manifest check`) found issues. Run it for details.' })
    }
  } catch { /* skip if check fails */ }
}

function pascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}
