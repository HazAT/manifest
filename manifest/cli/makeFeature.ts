/**
 * Output an agent prompt for creating a new feature.
 *
 * Usage: bun manifest make:feature UserRegistration [--route="POST /api/users"] [--auth=none]
 *
 * Does NOT write any files. Instead, prints a structured prompt that tells an
 * agent exactly what file to create, the full template, and what to fill in.
 */

export const meta = {
  name: 'feature make',
  description: 'Output an agent prompt for scaffolding a new feature (no files written)',
  usage: 'bun manifest feature make <Name> [--route="METHOD /path"] [--auth=none|required] [--type=stream]',
}

export async function makeFeature(args: string[]): Promise<void> {
  const className = args[0]

  if (!className) {
    console.error('  Usage: bun manifest make:feature <ClassName> [--route="METHOD /path"] [--auth=none|required] [--type=stream]')
    process.exit(1)
  }

  let route = ''
  let auth = 'required'
  let type = 'request'

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--route=')) route = arg.slice(8).replace(/"/g, '')
    if (arg.startsWith('--auth=')) auth = arg.slice(7)
    if (arg.startsWith('--type=')) type = arg.slice(7)
  }

  const kebabName = className
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()

  const defaultMethod = type === 'stream' ? 'POST' : 'GET'
  let routeLine = `route: ['${defaultMethod}', '/api/${kebabName}'],`
  if (route) {
    const [method, ...pathParts] = route.split(' ')
    routeLine = `route: ['${method!.toUpperCase()}', '${pathParts.join(' ')}'],`
  }

  const typeLine = type === 'stream' ? `\n  type: 'stream',` : ''

  const handlerBlock = type === 'stream'
    ? `async stream({ input, emit, close, fail }) {
    // [FILL IN: Implement streaming logic.]
    emit('Started streaming')
    // emit('event-name', { data: 'value' })
    // Stream auto-closes when this function returns
  },`
    : `async handle({ input, ok, fail }) {
    // [FILL IN: Implement the feature logic. Keep it linear — no hidden branches.]
    return ok('${className} executed')
  },`

  const fillInHandler = type === 'stream'
    ? `5. **stream() logic** — Implement the streaming logic. Use \`emit()\` to send events, \`close()\` to end the stream early, \`fail()\` for errors. The stream auto-closes when the function returns.`
    : `5. **handle() logic** — Implement the business logic. Use \`ok()\` for success, \`fail()\` for errors.`

  const prompt = `You are creating a new feature called '${kebabName}'.

Create the file \`features/${className}.ts\` with the following template:

\`\`\`typescript
// features/${className}.ts
import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: '${kebabName}',${typeLine}
  description: \\\`[FILL IN: 2-3 sentences explaining what this feature does, why it exists,
                and any important context. Write for an agent reading this cold.]\\\`,
  ${routeLine}
  authentication: '${auth}',
  sideEffects: [
    // [FILL IN: List ALL side effects — database writes, emails sent, API calls made, etc.]
  ],
  errorCases: [
    // [FILL IN: List ALL error cases with HTTP status codes, e.g. '409 - Email already registered']
  ],

  input: {
    // [FILL IN: Define input fields using t.string(), t.integer(), etc.]
    // Every field MUST have a description explaining what it is and why it exists.
    // Example:
    // email: t.string({ description: 'User email address for account creation.', required: true }),
  },

  ${handlerBlock}
})
\`\`\`

## What you need to fill in

1. **description** — 2-3 sentences. Explain what this feature does, why it exists, and any important context. Write for an agent that has never seen this codebase.
2. **input fields** — Define every input field with \`t.string()\`, \`t.integer()\`, etc. Every field must have a \`description\`.
3. **sideEffects** — List every side effect: database writes, emails, external API calls. Can be empty array if pure.
4. **errorCases** — List every error case with HTTP status code, e.g. \`'422 - Validation failed'\`.
${fillInHandler}

## After creation

- Run \`bun manifest check\` to validate the feature follows conventions.
- Create a matching test file at \`tests/${className}.test.ts\` using \`createTestClient\` from \`../manifest/testing\`.`

  console.log(prompt)
}
