/**
 * Output an agent prompt for creating a new service.
 *
 * Usage: bun manifest service make BlogPosts
 *
 * Does NOT write any files. Instead, prints a structured prompt that tells an
 * agent exactly what file to create, the full template, and what to fill in.
 */

export const meta = {
  name: 'service make',
  description: 'Output an agent prompt for scaffolding a new service (no files written)',
  usage: 'bun manifest service make <Name>',
}

export async function makeService(args: string[]): Promise<void> {
  const className = args[0]

  if (!className) {
    console.error('  Usage: bun manifest service make <PascalCaseName>')
    process.exit(1)
  }

  // PascalCase → camelCase for the filename and export name
  const camelName = className.charAt(0).toLowerCase() + className.slice(1)

  const prompt = `You are creating a new service called '${camelName}'.

Create the file \`services/${camelName}.ts\` with the following template:

\`\`\`typescript
// services/${camelName}.ts

/**
 * [FILL IN: What this service does and when to use it.
 * Services are for reusable logic shared across features, scripts, or other services.
 * If the logic is only used in one feature, keep it inline in that feature instead.]
 */
export const ${camelName} = {
  /** [FILL IN: What this function does.] */
  async doThing(opts: { /* [FILL IN: typed parameters] */ }): Promise<void> {
    // [FILL IN: Implementation]
  },
}
\`\`\`

## What you need to fill in

1. **Top-level JSDoc** — Explain what this service does and when to use it. Write for an agent that has never seen this codebase.
2. **Methods** — Replace \`doThing\` with real methods. Each method must have:
   - A JSDoc comment explaining what it does
   - Typed parameters (use an options object for multiple params)
   - A typed return value
3. **Implementation** — Write the actual logic.

## Guidance

- **Services are for reusable logic shared across features, scripts, or other services.** If the logic is only used in one feature, keep it inline in that feature instead.
- Services are plain exported objects with methods. No classes. No DI container. TypeScript's module system is the dependency injection.
- Features import services directly: \`import { ${camelName} } from '../services/${camelName}'\`
- Keep services focused — one responsibility per service.

## After creation

- Run \`bun manifest check\` to validate JSDoc conventions.
- Import and use the service from your features.`

  console.log(prompt)
}
