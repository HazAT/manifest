/**
 * Extension CLI subcommands.
 *
 * `make` and `install` output agent prompts (like makeFeature).
 * `list` performs a read-only scan and outputs a table.
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const meta = [
  {
    name: 'extension make',
    description: 'Output an agent prompt for scaffolding a new extension (no files written)',
    usage: 'bun manifest extension make <name>',
  },
  {
    name: 'extension install',
    description: 'Output an agent prompt for installing an extension from GitHub or npm',
    usage: 'bun manifest extension install <url|name>',
  },
  {
    name: 'extension list',
    description: 'List all installed extensions with version and description',
    usage: 'bun manifest extension list',
  },
]

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

function capitalize(name: string): string {
  return name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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

export async function makeExtension(args: string[]): Promise<void> {
  const rawName = args[0]

  if (!rawName) {
    console.error('  Usage: bun manifest extension make <name>')
    process.exit(1)
  }

  const name = toKebabCase(rawName)
  const title = capitalize(name)

  const prompt = `You are creating a new extension called '${name}'.

## Steps

1. Create the directory \`extensions/${name}/\`

2. Create \`extensions/${name}/EXTENSION.md\` with this content:

\`\`\`markdown
---
name: ${name}
version: 0.1.0
description: ""
author: ""
---

# ${title} Extension

## What This Does

[FILL IN: 2-3 sentences explaining what this extension provides and why.]

## Install Instructions

[FILL IN: Steps an agent should follow after installing this extension.
Include any config changes, environment variables, database migrations,
or dependencies that need to be set up.]

## Configuration

[FILL IN: Any configuration needed in config/ files. Remove if none.]

## Features

[FILL IN: Table of features this extension provides, if any. Remove if none.]

| Name | Route | Description |
|------|-------|-------------|

## Troubleshooting

[FILL IN: Common issues, what can go wrong, and how to fix it. This section
is read by \`bun manifest doctor\` and shown to agents when diagnosing problems.
Write it as step-by-step checks an agent can follow to self-repair.]

## Dependencies

[FILL IN: npm packages, other extensions, or services this depends on. Remove if none.]
\`\`\`

3. Create subdirectories based on what the extension will contain:
   - \`extensions/${name}/features/\` — if it provides API features
   - \`extensions/${name}/schemas/\` — if it defines database tables
   - \`extensions/${name}/services/\` — if it provides shared services

4. Run \`bun manifest index\` to regenerate MANIFEST.md.

## After creation

- Fill in all [FILL IN] sections in EXTENSION.md
- Implement the extension's features, schemas, and services
- Run \`bun manifest check\` to validate conventions`

  console.log(prompt)
}

export async function installExtension(args: string[]): Promise<void> {
  const source = args[0]

  if (!source) {
    console.error('  Usage: bun manifest extension install <source>')
    console.error('')
    console.error('  Sources:')
    console.error('    https://github.com/user/repo   GitHub repository')
    console.error('    npm:<package>                   npm package')
    process.exit(1)
  }

  const isGitHub = source.startsWith('https://github.com/') || source.startsWith('github.com/')
  const isNpm = source.startsWith('npm:')

  if (!isGitHub && !isNpm) {
    console.error(`Error: Unrecognized source format: ${source}`)
    console.error('')
    console.error('Expected formats:')
    console.error('  https://github.com/user/repo   GitHub repository')
    console.error('  npm:<package>                   npm package')
    process.exit(1)
  }

  if (isGitHub) {
    const url = source.startsWith('github.com/') ? `https://${source}` : source
    const name = url.replace(/\/+$/, '').split('/').pop()!.replace(/\.git$/, '')

    const prompt = `You are installing a Manifest extension from GitHub.

## Steps

1. Run: \`git clone ${url} extensions/${name}\`

2. Verify \`extensions/${name}/EXTENSION.md\` exists.
   - If missing, this is **not** a valid Manifest extension. Remove the directory and report the error.

3. If \`extensions/${name}/package.json\` exists, run: \`cd extensions/${name} && bun install\`

4. Read \`extensions/${name}/EXTENSION.md\` and follow the **Install Instructions** section carefully.

5. Run: \`bun manifest index\``

    console.log(prompt)
  } else {
    const packageName = source.slice(4) // strip "npm:"
    const name = packageName.includes('/') ? packageName.split('/').pop()! : packageName

    const prompt = `You are installing a Manifest extension from npm.

## Steps

1. Run: \`bun add ${packageName}\`

2. Run: \`mkdir -p extensions && ln -s ../node_modules/${packageName} extensions/${name}\`

3. Verify \`extensions/${name}/EXTENSION.md\` exists.
   - If missing, this is **not** a valid Manifest extension. Remove the symlink, uninstall the package, and report the error.

4. Read \`extensions/${name}/EXTENSION.md\` and follow the **Install Instructions** section carefully.

5. Run: \`bun manifest index\``

    console.log(prompt)
  }
}

export async function listExtensions(_args: string[]): Promise<void> {
  const extensionsDir = join(process.cwd(), 'extensions')

  if (!existsSync(extensionsDir)) {
    console.log('No extensions installed.')
    return
  }

  let entries: string[]
  try {
    entries = readdirSync(extensionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() || d.isSymbolicLink())
      .map(d => d.name)
  } catch {
    console.log('No extensions installed.')
    return
  }

  if (entries.length === 0) {
    console.log('No extensions installed.')
    return
  }

  const rows: Array<{ name: string; version: string; description: string; warning?: string }> = []

  for (const entry of entries) {
    const mdPath = join(extensionsDir, entry, 'EXTENSION.md')
    if (!existsSync(mdPath)) {
      rows.push({ name: entry, version: '?', description: '⚠ Missing EXTENSION.md', warning: 'yes' })
      continue
    }

    try {
      const content = readFileSync(mdPath, 'utf-8')
      const meta = parseFrontmatter(content)
      rows.push({
        name: meta.name || entry,
        version: meta.version || '?',
        description: meta.description || '',
      })
    } catch {
      rows.push({ name: entry, version: '?', description: '⚠ Could not read EXTENSION.md', warning: 'yes' })
    }
  }

  // Calculate column widths
  const nameW = Math.max(4, ...rows.map(r => r.name.length))
  const verW = Math.max(7, ...rows.map(r => r.version.length))
  const descW = Math.max(11, ...rows.map(r => r.description.length))

  const header = `${'Name'.padEnd(nameW)}  ${'Version'.padEnd(verW)}  ${'Description'.padEnd(descW)}`
  const separator = `${'-'.repeat(nameW)}  ${'-'.repeat(verW)}  ${'-'.repeat(descW)}`

  console.log(header)
  console.log(separator)
  for (const row of rows) {
    console.log(`${row.name.padEnd(nameW)}  ${row.version.padEnd(verW)}  ${row.description}`)
  }
}
