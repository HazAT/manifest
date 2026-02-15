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

import { scanFeatures } from '../scanner'
import path from 'path'
import { existsSync } from 'fs'

export async function check(_args: string[]): Promise<number> {
  const projectDir = process.cwd()
  const issues: string[] = []
  const passes: string[] = []

  const registry = await scanFeatures(path.join(projectDir, 'features'))
  const features = Object.entries(registry)

  const routes = new Map<string, string>()

  for (const [name, feature] of features) {
    if (!feature.description || feature.description.trim().length === 0) {
      issues.push(`Feature '${name}' has no description.`)
    }

    if (!feature.sideEffects) {
      issues.push(`Feature '${name}' is missing sideEffects declaration (can be empty array).`)
    }

    if (feature.type === 'request' && feature.route.length === 0) {
      issues.push(`Feature '${name}' is type 'request' but has no route.`)
    }

    for (const [fieldName, fieldDef] of Object.entries(feature.input)) {
      if (!fieldDef.description || fieldDef.description.trim().length === 0) {
        issues.push(`Feature '${name}' input field '${fieldName}' has no description.`)
      }
    }

    const testPaths = [
      path.join(projectDir, 'tests', `${pascalCase(name)}.test.ts`),
      path.join(projectDir, 'tests', `${name}.test.ts`),
    ]
    const hasTest = testPaths.some((p) => existsSync(p))
    if (!hasTest) {
      issues.push(`Feature '${name}' has no test file.`)
    }

    if (feature.route.length > 0) {
      const routeKey = `${feature.route[0]} ${feature.route[1]}`
      if (routes.has(routeKey)) {
        issues.push(`Duplicate route '${routeKey}' in features '${routes.get(routeKey)}' and '${name}'.`)
      }
      routes.set(routeKey, name)
    }
  }

  if (existsSync(path.join(projectDir, 'MANIFEST.md'))) {
    passes.push('MANIFEST.md exists.')
  } else {
    issues.push('MANIFEST.md does not exist. Run `bun manifest index` to generate it.')
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
    console.log(`  ${issues.length} issue(s) found.\n`)
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
