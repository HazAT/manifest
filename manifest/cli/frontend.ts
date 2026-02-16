/**
 * Frontend CLI subcommands.
 *
 * `install` outputs an agent prompt for preset selection.
 * `build` and `dev` are real commands that do work.
 */

import { buildFrontend, watchFrontend } from '../frontend'

export const meta = [
  {
    name: 'frontend install',
    description: 'Output an agent prompt to choose and install a frontend preset',
    usage: 'bun manifest frontend install',
  },
  {
    name: 'frontend build',
    description: 'Build the frontend for production',
    usage: 'bun manifest frontend build',
  },
  {
    name: 'frontend dev',
    description: 'Start a standalone frontend file watcher with live reload',
    usage: 'bun manifest frontend dev',
  },
]

export async function frontendInstall(_args: string[]): Promise<void> {
  const prompt = `You are setting up a frontend for this Manifest project.

## Available Presets

1. **static** — HTML + Tailwind + vanilla TypeScript. No framework.
   Best for: blogs, landing pages, server-rendered dashboards, simple sites.
   Install: bun manifest extension install https://github.com/HazAT/manifest-frontend-static

2. **reactive** — SolidJS + Tailwind. Client-side reactivity without a virtual DOM.
   Best for: interactive apps, dashboards, SPAs with client-side state.
   Install: bun manifest extension install https://github.com/HazAT/manifest-frontend-reactive

## What to do

Ask the user which preset fits their needs. If they're unsure, ask what they're building:
- Content sites, blogs, simple pages → static
- Interactive apps, real-time UIs, dashboards → reactive

After choosing, run the install command above and follow the extension's EXTENSION.md instructions completely.`

  console.log(prompt)
}

export async function frontendBuild(_args: string[]): Promise<void> {
  const projectDir = process.cwd()

  console.log('Building frontend...\n')
  const result = await buildFrontend(projectDir)

  if (!result.success) {
    console.error('\nBuild failed.')
    for (const err of result.errors) {
      console.error(`  ${err}`)
    }
    process.exit(1)
  }

  console.log(`\n✓ Built ${result.outputs.length} file(s)`)
}

export async function frontendDev(_args: string[]): Promise<void> {
  const projectDir = process.cwd()

  console.log('Starting standalone frontend dev watcher...')
  console.log('Note: In most cases you don\'t need this — `bun --hot index.ts` watches frontend/ and triggers live reload automatically.')
  console.log('This command is for when you run the watcher separately from the server.\n')

  await watchFrontend(projectDir, () => {
    console.log('[frontend] reload triggered')
  })
}
