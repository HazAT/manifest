/**
 * Scaffold a new feature file.
 *
 * Usage: bun manifest make:feature UserRegistration [--route="POST /api/users"] [--auth=none]
 *
 * Generates features/<Name>.ts with the correct structure, imports, and TODO markers.
 */

import path from 'path'
import { existsSync } from 'fs'

export async function makeFeature(args: string[]): Promise<void> {
  const projectDir = process.cwd()
  const className = args[0]

  if (!className) {
    console.error('  Usage: bun manifest make:feature <ClassName> [--route="METHOD /path"] [--auth=none|required]')
    process.exit(1)
  }

  let route = ''
  let auth = 'required'

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--route=')) route = arg.slice(8).replace(/"/g, '')
    if (arg.startsWith('--auth=')) auth = arg.slice(7)
  }

  const kebabName = className
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()

  let routeLine = `route: ['GET', '/api/${kebabName}'],`
  if (route) {
    const [method, ...pathParts] = route.split(' ')
    routeLine = `route: ['${method!.toUpperCase()}', '${pathParts.join(' ')}'],`
  }

  const code = `// features/${className}.ts
import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: '${kebabName}',
  description: \`TODO: Describe what this feature does. Be verbose - this is read by agents.
                Write 2-3 sentences explaining the purpose, behavior, and any important context.\`,
  ${routeLine}
  authentication: '${auth}',
  sideEffects: [
    // TODO: List ALL side effects (database writes, emails sent, API calls made, etc.)
  ],
  errorCases: [
    // TODO: List ALL error cases with HTTP status codes.
  ],

  input: {
    // TODO: Define input fields. Every field MUST have a description.
  },

  async handle({ input, ok, fail }) {
    // TODO: Implement feature logic.
    return ok('${className} executed')
  },
})
`

  const featuresDir = path.join(projectDir, 'features')
  const filePath = path.join(featuresDir, `${className}.ts`)

  if (existsSync(filePath)) {
    console.error(`\n  Feature already exists: features/${className}.ts\n`)
    process.exit(1)
  }

  await Bun.write(filePath, code)
  console.log(`\n  ✓ Created features/${className}.ts`)
  console.log(`  ✓ Run 'bun manifest check' to validate.\n`)
}
