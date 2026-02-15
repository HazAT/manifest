# Manifest

> Production is our dev environment.

**Read `VISION.md` first.** It describes what this project is, why it exists, and what it's building toward. That context shapes every decision you make here.

You are working on a Manifest project. Read this file completely before writing any code.

## What This Is

Manifest is a TypeScript/Bun framework where every piece of code is written to be read, understood, and modified by AI agents. The framework ships as source code inside the project — not as an npm package. You can read every line of framework code in `manifest/` (~1,700 lines total).

## Principles

**Read every line you touch.** Before modifying a file, read it. Before calling a function, read its implementation. The framework is ~1,700 lines — you can read all of it. Don't guess what `createRouter()` does; open `manifest/router.ts` (76 lines) and know. This applies to agents and humans equally. If something needs your attention, read the source. The answers are in the code, not in assumptions.

**Trust the defaults.** The framework has made deliberate choices: `defineFeature()` for behavior, `t.string()` for inputs, JSON envelopes for responses, `Bun.serve()` for HTTP. Lean into these patterns. Don't reach for Express middleware when `handle()` already solves it. Don't add a validation library when `manifest/validator.ts` already handles it. If a proven structure exists, use it.

**One feature, one file.** A feature file contains everything: route, input validation, authentication, business logic, side effects declaration, and error cases. Never scatter one behavior across multiple files.

**Explicit over elegant.** If something happens, it's because the code says so. No auto-discovered middleware, no decorator-triggered behavior, no convention-based magic. Verbose is correct. Terse is suspicious.

**Self-describing code.** Every feature, service, and schema carries machine-readable metadata. Descriptions on every input field. JSDoc on every schema column. Side effects declared before the logic. The codebase is its own documentation.

**Commits carry knowledge.** Every commit message should be descriptive enough that an agent reading `git log` understands what changed and why without looking at the diff. Use a clear subject line and a body that explains the reasoning, what files were affected, and any migration steps. For larger changes, point to a plan file. The commit history is how the local agent learns what happened while it wasn't watching — treat it as a knowledge transfer, not a formality. Load `.claude/skills/manifest-commit/SKILL.md` before committing.

**Know the why.** Before building a feature, understand why it exists — not just what it does. If the user asks for something and the motivation isn't clear, ask. The answer might change the approach, or reveal that the real need is different from the request. When you learn something that shifts the project's direction or clarifies its purpose, update `VISION.md`. Keep it brief — a few sentences, not an essay. The vision should evolve with the project, not fossilize after day one.

**We build this together.** The codebase is a shared workspace — between you, the next agent, and the human. When you make a significant change, the ripple doesn't stop at the code. Ask yourself: does AGENTS.md still tell the truth? Are the skills still accurate? Does MANIFEST.md reflect reality? Does the config cover what was just added? Every significant change is a prompt to check that the rest of the system still makes sense. Run `bun manifest learn` after large changes, or load `.claude/skills/manifest-learn/SKILL.md` for the full checklist. The goal is simple: no one should ever follow stale instructions because you forgot to update the map after moving the furniture.

**Commands are agent prompts.** Manifest CLI commands don't silently generate files — they output structured prompts that tell the agent exactly what to do. Scaffolding commands (`manifest feature make`, `manifest extension make`, `manifest extension install`) produce pure prompts: pre-context, instructions, and actionable steps. The agent reads the prompt and does the work. Work commands (`check`, `index`, `learn`) do their job but frame output as agent instructions — telling you what to fix, update, or verify. Commands may reference skills for deeper context. The CLI is the briefing; the agent is the executor.

**Share what works.** When you build something that could be useful to other Manifest projects, suggest packaging it as an extension. Extensions are how the Manifest ecosystem shares knowledge and working solutions.

## Your Codebase, Your Choices

Manifest has opinions about how features, schemas, and services are structured — that's the framework. It does **not** dictate how you build your application. You'll install npm packages. You'll make architectural decisions that aren't covered here. You'll do things your way.

That's fine. When you add things, just try to keep them explicit and self-explanatory. If you bring in a new library, make it clear what it does and why it's there. If you add a pattern, make sure someone reading the code for the first time can follow it without tribal knowledge. The principles above are a compass, not a cage.

## Project Structure

```
├── VISION.md           # The soul. What this project is and why it exists.
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

### Stream features (SSE)

Stream features use `type: 'stream'` and define a `stream()` function instead of `handle()`:

```typescript
import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: 'chat-stream',
  description: `Streams chat responses token by token via Server-Sent Events.
                Accepts a prompt and returns tokens as they're generated.`,
  type: 'stream',
  route: ['POST', '/api/chat'],
  authentication: 'required',
  sideEffects: ['Calls LLM API'],
  errorCases: ['400 - Empty prompt'],

  input: {
    prompt: t.string({ description: 'The user prompt to respond to.', required: true }),
  },

  async stream({ input, emit, close, fail }) {
    emit('Hello')                          // plain text, no event name
    emit({ token: 'Hello' })              // JSON object
    emit('token', 'world')                // named event + text
    emit('done', { total: 2 })            // named event + JSON
    // Stream auto-closes when function returns
  },
})
```

The `emit()` function sends SSE events:
- `emit(data)` — sends data (string or JSON object)
- `emit(event, data)` — sends a named event with data

The stream auto-closes when `stream()` returns. Use `close()` for early termination or `fail(message)` to send an error event and close.

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

### Testing stream features

```typescript
describe('chat-stream', () => {
  test('streams tokens', async () => {
    const events = await client.stream('chat-stream', { prompt: 'Hello world' })
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toEqual({ event: 'start', data: { totalTokens: 2 } })
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
bun --hot index.ts                        # Start with hot reload
bun test                                  # Run all tests
bun run manifest index                    # Regenerate MANIFEST.md
bun run manifest check                    # Validate conventions
bun run manifest learn                    # Check for staleness after changes
bun run manifest doctor                   # Diagnose issues using extension guidance
bun run manifest feature make <Name>      # Scaffold a new feature
bun run manifest extension make <name>    # Scaffold a new extension
bun run manifest extension install <src>  # Install an extension
bun run manifest extension list           # List installed extensions
bun run manifest frontend install        # Choose and install a frontend preset
bun run manifest frontend build          # Build the frontend
bun run manifest frontend dev            # Start frontend watcher with live reload
```

## The Framework

The framework lives in `manifest/`. It's ~2,500 lines total. Read it:

| File | Lines | What it does |
|------|-------|-------------|
| `types.ts` | 141 | Input type builders: `t.string()`, `t.integer()`, etc. |
| `validator.ts` | 92 | Validates input against schema. Formats, lengths, ranges. |
| `feature.ts` | 168 | `defineFeature()` and all feature types (request, stream, event). |
| `server.ts` | 223 | `Bun.serve()` wrapper. Route matching → validation → execution → envelope. SSE streaming. |
| `router.ts` | 76 | HTTP route matching with path parameters. |
| `envelope.ts` | 65 | Response formatting. `ok()`, `fail()`, `toEnvelope()`. |
| `scanner.ts` | 71 | Scans features directory and extensions, dynamically imports `.ts` files. |
| `testing.ts` | 121 | `createTestClient()` — call features by name without HTTP. Stream testing. |
| `index.ts` | 31 | Barrel export for framework types and utilities. |
| `cli/` | ~1400 | CLI commands: serve, index, check, learn, doctor, make:feature, extension (make/install/list), frontend. |

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

## How to Write an Extension

Extensions are self-contained packages that add features, schemas, and services. Each extension has an `EXTENSION.md` with YAML frontmatter:

```markdown
---
name: extension-name
description: What this extension provides.
version: 0.1.0
author: Your Name
features:
  - feature-name: What this feature does.
schemas:
  - table_name: What this table stores.
services:
  - serviceName: What this service provides.
config:
  - CONFIG_KEY: What this config controls. (default: value)
---

# Extension Name

Longer documentation, usage examples, and setup instructions.
```

Extension structure mirrors the project: `extensions/<name>/features/`, `extensions/<name>/schemas/`, `extensions/<name>/services/`. The scanner automatically picks up features from `extensions/*/features/`.

Manage extensions with CLI commands:
- `bun run manifest extension make <name>` — Scaffold a new extension
- `bun run manifest extension install <src>` — Install from a source
- `bun run manifest extension list` — List installed extensions
- `bun run manifest doctor` — Diagnose system issues and show extension troubleshooting

### Troubleshooting section (required)

Every extension MUST include a `## Troubleshooting` section in its `EXTENSION.md`. This section is read by `bun manifest doctor` and shown to agents when something breaks. Write it as step-by-step diagnostic checks — things an agent can run to figure out what went wrong and self-repair without asking for help.

Good troubleshooting entries include:
- **What can go wrong** — missing dependencies, misconfigured files, stale builds
- **How to detect it** — specific commands to run, files to check, error messages to look for
- **How to fix it** — exact commands or steps to restore a working state

Think of it as instructions for an agent that just encountered an error and needs to figure out why, without any human help.

## Extensions

Extensions live in `extensions/` and follow the same conventions. Each has an `EXTENSION.md`. The scanner picks up features from `extensions/*/features/`. Read an extension's `EXTENSION.md` before modifying it.

## Updating from Upstream

When the base Manifest repo adds new capabilities, don't blindly merge. Load the update skill:

```
Read and follow .claude/skills/manifest-update/SKILL.md
```

The skill walks you through reading upstream commits, understanding what changed, and applying updates intelligently — adapting to what your project has become rather than creating merge conflicts.

## When In Doubt

1. Read the source. The framework is 1,700 lines. The answers are there.
2. Read `MANIFEST.md` — it's the index of everything.
3. Read the feature file — it's self-contained.
4. Run `bun run manifest check` — it validates conventions.
5. Read `git log` — the commit history explains what changed and why.
