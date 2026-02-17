/**
 * Rebuild MANIFEST.md from the current codebase state.
 *
 * Usage: bun manifest index
 *
 * Scans features/, schemas/, services/, and commands/ directories.
 * Generates a MANIFEST.md that serves as the agent's entry point
 * to the codebase.
 */

import { scanAllFeatures } from '../scanner'
import path from 'path'
import { readdirSync, readFileSync, existsSync } from 'fs'

export const meta = {
  name: 'index',
  description: 'Rebuild MANIFEST.md from the current codebase state',
  usage: 'bun manifest index',
}

export async function indexManifest(_args: string[]): Promise<void> {
  const projectDir = process.cwd()

  const registry = await scanAllFeatures(projectDir)
  const features = Object.values(registry)

  const schemaCount = countFiles(path.join(projectDir, 'schemas'), '.ts')
  const serviceCount = countFiles(path.join(projectDir, 'services'), '.ts')
  const commandCount = countFiles(path.join(projectDir, 'commands'), '.ts')

  let md = `# Manifest: ${path.basename(projectDir)}\n\n`

  md += `## System\n`
  md += `- Runtime: Bun ${Bun.version}, TypeScript, Manifest 0.1.x\n`
  md += `- Generated: ${new Date().toISOString().slice(0, 10)}\n\n`

  md += `## Architecture\n`
  md += `This is a Manifest application. All behavior lives in feature files.\n`
  md += `- features/ - One file per application behavior (${features.length} features)\n`
  md += `- schemas/ - Drizzle ORM table definitions (${schemaCount} schemas)\n`
  md += `- services/ - Shared services (${serviceCount} services)\n`
  md += `- commands/ - CLI commands (${commandCount} commands)\n\n`

  md += `## Conventions\n`
  md += `- NEVER use decorator-based patterns. Features are defined with defineFeature().\n`
  md += `- NEVER create event listeners or middleware. Side effects go in the feature's handle() function.\n`
  md += `- NEVER scatter one behavior across multiple files. One feature = one file.\n`
  md += `- Every input field MUST have a description.\n`
  md += `- Features MUST declare all side effects in the feature definition.\n`
  md += `- Schema fields MUST have JSDoc descriptions.\n`
  md += `- All dependencies MUST be explicit imports. No global state, no service locators.\n\n`

  md += `## Feature Index\n`
  md += `| Name | Route | Type | Description |\n`
  md += `|------|-------|------|-------------|\n`

  for (const feature of features) {
    const route = feature.route
      ? `${feature.route[0]} ${feature.route[1]}`
      : ('trigger' in feature ? (feature as any).trigger : 'n/a')
    const desc = feature.description.replace(/\s+/g, ' ').slice(0, 80)
    md += `| ${feature.name} | ${route} | ${feature.type} | ${desc} |\n`
  }

  // Extensions section
  const extensionsDir = path.join(projectDir, 'extensions')
  if (existsSync(extensionsDir)) {
    const extEntries = readdirSync(extensionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() || d.isSymbolicLink())
    if (extEntries.length > 0) {
      const rows: Array<{ name: string; version: string; description: string }> = []
      for (const entry of extEntries) {
        const mdPath = path.join(extensionsDir, entry.name, 'EXTENSION.md')
        if (existsSync(mdPath)) {
          const meta = parseFrontmatter(readFileSync(mdPath, 'utf-8'))
          rows.push({
            name: meta.name || entry.name,
            version: meta.version || '?',
            description: meta.description || '',
          })
        } else {
          rows.push({ name: entry.name, version: '?', description: 'Missing EXTENSION.md' })
        }
      }
      md += `\n## Extensions\n`
      md += `| Name | Version | Description |\n`
      md += `|------|---------|-------------|\n`
      for (const row of rows) {
        md += `| ${row.name} | ${row.version} | ${row.description} |\n`
      }
      md += `\n`
    }
  }

  // CLI Commands section
  const { getAllCommandMeta } = await import('./meta')
  const commands = getAllCommandMeta()
  if (commands.length > 0) {
    md += `\n## CLI Commands\n`
    md += `| Command | Description |\n`
    md += `|---------|-------------|\n`
    for (const cmd of commands) {
      md += `| \`${cmd.usage}\` | ${cmd.description} |\n`
    }
    md += `\n`
    md += `Start here: \`bun manifest status\` for a quick health check.\n`
    md += `\n`
  }

  md += `## Known Issues\n`
  md += `- None currently.\n`

  const manifestPath = path.join(projectDir, 'MANIFEST.md')
  await Bun.write(manifestPath, md)
  console.log(`\n  ✓ MANIFEST.md generated with ${features.length} features indexed.`)
  console.log(`  Review MANIFEST.md for accuracy, then commit if it looks correct.\n`)
}

function parseFrontmatter(content: string): Record<string, string> {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== '---') return {}

  const result: Record<string, string> = {}
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line === '---') break
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = value
  }
  return result
}

function countFiles(dir: string, ext: string): number {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(ext) && !f.endsWith('.test.ts')).length
  } catch {
    return 0
  }
}
