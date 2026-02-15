# Manifest

> Production is our dev environment.

You are working on a Manifest project. Read this file completely before writing any code.

## What This Is

Manifest is a TypeScript/Bun framework where every piece of code is written to be read, understood, and modified by AI agents. The framework ships as source code inside the project — not as an npm package. You can read every line of framework code in `manifest/` (~1,000 lines total).

## Principles

**Read every line you touch.** Before modifying a file, read it. Before calling a function, read its implementation. The framework is ~1,000 lines — you can read all of it. Don't guess what `createRouter()` does; open `manifest/router.ts` (76 lines) and know. This applies to agents and humans equally. If something needs your attention, read the source. The answers are in the code, not in assumptions.

**Trust the defaults.** The framework has made deliberate choices: `defineFeature()` for behavior, `t.string()` for inputs, JSON envelopes for responses, `Bun.serve()` for HTTP. Lean into these patterns. Don't reach for Express middleware when `handle()` already solves it. Don't add a validation library when `manifest/validator.ts` already handles it. If a proven structure exists, use it.

**One feature, one file.** A feature file contains everything: route, input validation, authentication, business logic, side effects declaration, and error cases. Never scatter one behavior across multiple files.

**Explicit over elegant.** If something happens, it's because the code says so. No auto-discovered middleware, no decorator-triggered behavior, no convention-based magic. Verbose is correct. Terse is suspicious.

**Self-describing code.** Every feature, service, and schema carries machine-readable metadata. Descriptions on every input field. JSDoc on every schema column. Side effects declared before the logic. The codebase is its own documentation.

**Commits carry knowledge.** Every commit message should be descriptive enough that an agent reading `git log` understands what changed and why without looking at the diff. Use a clear subject line and a body that explains the reasoning, what files were affected, and any migration steps. For larger changes, point to a plan file. The commit history is how the local agent learns what happened while it wasn't watching — treat it as a knowledge transfer, not a formality. Load `.claude/skills/manifest-commit/SKILL.md` before committing.

## Your Codebase, Your Choices

Manifest has opinions about how features, schemas, and services are structured — that's the framework. It does **not** dictate how you build your application. You'll install npm packages. You'll make architectural decisions that aren't covered here. You'll do things your way.

That's fine. When you add things, just try to keep them explicit and self-explanatory. If you bring in a new library, make it clear what it does and why it's there. If you add a pattern, make sure someone reading the code for the first time can follow it without tribal knowledge. The principles above are a compass, not a cage.

## Project Structure

```
├── MANIFEST.md         # Auto-generated index. Read this to orient yourself.
├── manifest/           # THE FRAMEWORK. Source code. Read it, modify it.
├── features/           # One file per behavior. This IS the application.
├── schemas/            # Drizzle ORM table definitions. One file per table.
├── services/           # Shared services. Plain exported functions.
├── policies/           # Authorization. One file per resource.
├── commands/           # CLI commands.
├── config/             # Typed config files. No YAML, no .env magic.
├── extensions/         # Third-party Manifest extensions (each has EXTENSION.md).
├── tests/              # Mirrors features/ 1:1.
└── index.ts            # Entry point.
```

**Start with `MANIFEST.md`** — it lists every feature, schema, service, and command with descriptions. Then read the relevant feature files.

## How to Write a Feature

Every feature uses `defineFeature()`:

```typescript
import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: 'feature-name',              // kebab-case, unique
  description: `Two to three sentences explaining what this feature does,
                why it exists, and any important context. Write for an agent
                that has never seen this codebase.`,
  route: ['POST', '/api/path'],
  authentication: 'required',         // 'required' | 'none' | 'optional'
  sideEffects: [
    'Inserts one row into users table',
    'Sends email via mailer service',
  ],
  errorCases: [
    '409 - Email already registered',
    '422 - Validation failed',
  ],

  input: {
    fieldName: t.string({
      description: 'What this field is and why it exists.',
      required: true,
    }),
  },

  async handle({ input, ok, fail }) {
    // Linear logic. No hidden branches.
    return ok('Success message', { data: { ... }, status: 201 })
  },
})
```

### Guidelines for features:
- **description** — Mandatory. 2-3 sentences. Written for an agent reading this cold.
- **input fields** — Every field needs a `description`.
- **sideEffects** — Declare side effects upfront (database writes, emails, API calls). Can be an empty array.
- **errorCases** — List error cases with HTTP status codes.
- **handle()** — Linear execution. All logic in one function.
- **imports** — All dependencies are explicit `import` statements. Follow the imports to understand what a feature touches.

### Feature types:
- `type: 'request'` (default) — HTTP endpoint with `route: ['METHOD', '/path']`
- `type: 'stream'` — SSE endpoint with `stream()` instead of `handle()`
- `type: 'event'` — Internal event with `trigger: 'event.name'` instead of route

## How to Write a Test

Tests mirror features 1:1. Use `createTestClient` to call features by name without HTTP:

```typescript
import { describe, test, expect } from 'bun:test'
import { createTestClient } from '../manifest/testing'
import path from 'path'

const client = createTestClient({
  featuresDir: path.resolve(__dirname, '../features'),
})

describe('feature-name', () => {
  test('happy path', async () => {
    const result = await client.call('feature-name', { field: 'value' })
    expect(result.status).toBe(200)
  })

  test('validation error', async () => {
    const result = await client.call('feature-name', {})
    expect(result.status).toBe(422)
  })
})
```

## How to Write a Schema

Drizzle ORM. Every column gets a JSDoc description:

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

/** Description of what this table stores. */
export const tableName = pgTable('table_name', {
  /** What this column is for. */
  id: uuid('id').primaryKey().defaultRandom(),
  /** What this column is for. */
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

## How to Write a Service

Plain exported functions. No classes. No DI container. TypeScript's module system is the dependency injection:

```typescript
/** What this service does and when to use it. */
export const serviceName = {
  async doThing(opts: { ... }): Promise<void> {
    // Implementation
  },
}
```

Features import services directly: `import { serviceName } from '../services/serviceName'`

## Common Commands

```bash
bun --hot index.ts              # Start with hot reload
bun test                        # Run all tests
bun run manifest index          # Regenerate MANIFEST.md
bun run manifest check          # Validate conventions
bun run manifest make:feature   # Scaffold a new feature
```

## The Framework

The framework lives in `manifest/`. It's ~1,000 lines total. Read it:

| File | Lines | What it does |
|------|-------|-------------|
| `types.ts` | 141 | Input type builders: `t.string()`, `t.integer()`, etc. |
| `validator.ts` | 92 | Validates input against schema. Formats, lengths, ranges. |
| `feature.ts` | 83 | `defineFeature()` and all feature types. |
| `server.ts` | 109 | `Bun.serve()` wrapper. Route matching → validation → execution → envelope. |
| `router.ts` | 76 | HTTP route matching with path parameters. |
| `envelope.ts` | 65 | Response formatting. `ok()`, `fail()`, `toEnvelope()`. |
| `scanner.ts` | 33 | Scans features directory, dynamically imports `.ts` files. |
| `testing.ts` | 73 | `createTestClient()` — call features by name without HTTP. |
| `cli/` | 352 | CLI commands: serve, index, check, make:feature. |

If something in the framework doesn't work for your use case, modify it. It's your code.

## Response Envelope

Every API response follows this shape:

```json
{
  "status": 200,
  "message": "Description of what happened",
  "data": { ... },
  "meta": {
    "feature": "feature-name",
    "request_id": "uuid",
    "duration_ms": 42
  }
}
```

Errors include `errors` instead of `data`:

```json
{
  "status": 422,
  "message": "Validation failed",
  "errors": { "email": "required", "password": "min_length" },
  "meta": { ... }
}
```

## Extensions

Extensions live in `extensions/` and follow the same conventions. Each has an `EXTENSION.md`. The scanner picks up features from `extensions/*/features/`. Read an extension's `EXTENSION.md` before modifying it.

## Updating from Upstream

When the base Manifest repo adds new capabilities, don't blindly merge. Load the update skill:

```
Read and follow .claude/skills/manifest-update/SKILL.md
```

The skill walks you through reading upstream commits, understanding what changed, and applying updates intelligently — adapting to what your project has become rather than creating merge conflicts.

## When In Doubt

1. Read the source. The framework is 1,000 lines. The answers are there.
2. Read `MANIFEST.md` — it's the index of everything.
3. Read the feature file — it's self-contained.
4. Run `bun run manifest check` — it validates conventions.
5. Read `git log` — the commit history explains what changed and why.
