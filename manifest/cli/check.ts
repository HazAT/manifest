/**
 * Validate that the project follows Manifest conventions.
 *
 * Usage: bun manifest check
 *
 * Checks:
 *   - Every feature has a description
 *   - Every feature has declared side effects (can be empty array)
 *   - Every feature with type 'request' has a route
 *   - Every feature has a test file
 *   - MANIFEST.md exists
 *   - All routes are unique
 *   - Every input field has a description
 */

import { scanAllFeatures } from '../scanner'
import path from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'

export async function check(_args: string[]): Promise<number> {
  const projectDir = process.cwd()
  const issues: string[] = []
  const passes: string[] = []

  const registry = await scanAllFeatures(projectDir)
  const features = Object.entries(registry)

  const routes = new Map<string, string>()

  for (const [name, feature] of features) {
    const featureFile = (feature as any)._sourcePath || `features/${pascalCase(name)}.ts`

    if (!feature.description || feature.description.trim().length === 0) {
      issues.push(`Feature '${name}' has no description. → Open ${featureFile} and add a 2-3 sentence description to the defineFeature() call.`)
    }

    if (!feature.sideEffects) {
      issues.push(`Feature '${name}' is missing sideEffects declaration. → Add sideEffects: [] to defineFeature() in ${featureFile}.`)
    }

    if (feature.type === 'request' && feature.route.length === 0) {
      issues.push(`Feature '${name}' is type 'request' but has no route. → Add route: ['METHOD', '/api/path'] to defineFeature() in ${featureFile}.`)
    }

    if (feature.type === 'stream') {
      if (!(feature as any).stream) {
        issues.push(`Feature '${name}' is type 'stream' but has no stream() function. → Add an async stream({ input, emit, close, fail }) function to defineFeature() in ${featureFile}.`)
      }
      if ((feature as any).handle) {
        issues.push(`Feature '${name}' is type 'stream' but has a handle() function. Stream features must use stream() instead. → Replace handle() with stream() in ${featureFile}.`)
      }
      if ((feature.route as any[]).length === 0) {
        issues.push(`Feature '${name}' is type 'stream' but has no route. Stream features require a route. → Add route: ['GET', '/api/path'] to defineFeature() in ${featureFile}.`)
      }
    }

    for (const [fieldName, fieldDef] of Object.entries(feature.input)) {
      if (!fieldDef.description || fieldDef.description.trim().length === 0) {
        issues.push(`Feature '${name}' input field '${fieldName}' has no description. → Add a description to the '${fieldName}' input field in ${featureFile}.`)
      }
    }

    const testPascal = pascalCase(name)
    const testPaths = [
      path.join(projectDir, 'tests', `${testPascal}.test.ts`),
      path.join(projectDir, 'tests', `${name}.test.ts`),
    ]
    const hasTest = testPaths.some((p) => existsSync(p))
    if (!hasTest) {
      issues.push(`Feature '${name}' has no test file. → Create tests/${testPascal}.test.ts mirroring ${featureFile}.`)
    }

    if (feature.route.length > 0) {
      const routeKey = `${feature.route[0]} ${feature.route[1]}`
      if (routes.has(routeKey)) {
        const otherName = routes.get(routeKey)!
        const otherFile = `features/${pascalCase(otherName)}.ts`
        issues.push(`Duplicate route '${routeKey}' in features '${otherName}' and '${name}'. → Resolve the route conflict between ${otherFile} and ${featureFile} — change one route.`)
      }
      routes.set(routeKey, name)
    }
  }

  // Check extensions have EXTENSION.md and a Troubleshooting section
  const extensionsDir = path.join(projectDir, 'extensions')
  if (existsSync(extensionsDir)) {
    try {
      const entries = readdirSync(extensionsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink())
      for (const entry of entries) {
        const mdPath = path.join(extensionsDir, entry.name, 'EXTENSION.md')
        if (!existsSync(mdPath)) {
          issues.push(`Extension '${entry.name}' has no EXTENSION.md. → Create extensions/${entry.name}/EXTENSION.md or run: bun manifest extension make ${entry.name}`)
        } else {
          try {
            const content = readFileSync(mdPath, 'utf-8')
            if (!/^## Troubleshooting\b/m.test(content)) {
              issues.push(`Extension '${entry.name}' has no Troubleshooting section. → Add a \`## Troubleshooting\` section to extensions/${entry.name}/EXTENSION.md so \`bun manifest doctor\` can help agents self-repair.`)
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (existsSync(path.join(projectDir, 'MANIFEST.md'))) {
    passes.push('MANIFEST.md exists.')
  } else {
    issues.push('MANIFEST.md does not exist. → Run: bun manifest index')
  }

  const hasDuplicateRoutes = issues.some((i) => i.startsWith('Duplicate route'))
  if (!hasDuplicateRoutes) {
    passes.push('All routes are unique.')
  }

  console.log('')
  for (const issue of issues) {
    console.log(`  \x1b[31m✗\x1b[0m ${issue}`)
  }
  for (const pass of passes) {
    console.log(`  \x1b[32m✓\x1b[0m ${pass}`)
  }
  console.log('')

  if (issues.length > 0) {
    console.log(`  Fix these ${issues.length} issue(s), then run \`bun manifest check\` again to verify.\n`)
    return 1
  }

  console.log(`  All checks passed.\n`)
  return 0
}

function pascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}
