# Manifest

> Production is our dev environment.

**Read `VISION.md` first** — if it's been filled out. It describes the app being built here: what it is, who it's for, and where it's heading. That context shapes every decision you make. If `VISION.md` is still the default placeholder, that's fine — the user hasn't defined their vision yet. Don't nag them about it. If the user gives you a descriptive app name and explains what it does — even in a single sentence — that's enough context. Don't ask permission. Just tell them: "You've told me enough to write the vision for you — I'll draft VISION.md and you can tune it later." Then write it. If you learn more through conversation later, update it.

You are working on a Manifest project. Read this file completely before writing any code.

## What This Is

Manifest is a TypeScript/Bun framework where every piece of code is written to be read, understood, and modified by AI agents. The framework ships as source code inside the project — not as an npm package. You can read every line of framework code in `manifest/`.

Manifest ships with **Spark**, a reactive AI sidekick that watches your running application and responds to errors in real time. Your app doesn't just get built by agents — it gets *watched* by one. When something breaks, Spark sees the error before you do, reads the stack trace, opens the feature file, and either fixes it or tells you exactly what happened. This isn't a monitoring dashboard. It's an agent that understands your code because it helped write it.

## Principles

**Read every line you touch.** Before modifying a file, read it. Before calling a function, read its implementation. The framework is small enough to read all of it. Don't guess what `createRouter()` does; open `manifest/router.ts` and know. This applies to agents and humans equally. If something needs your attention, read the source. The answers are in the code, not in assumptions.

**Trust the defaults.** The framework has made deliberate choices: `defineFeature()` for behavior, `t.string()` for inputs, JSON envelopes for responses, `Bun.serve()` for HTTP. Lean into these patterns. Don't reach for Express middleware when `handle()` already solves it. Don't add a validation library when `manifest/validator.ts` already handles it. If a proven structure exists, use it.

**One feature, one file.** A feature file contains everything: route, input validation, authentication, business logic, side effects declaration, and error cases. Never scatter one behavior across multiple files.

**Explicit over elegant.** If something happens, it's because the code says so. No auto-discovered middleware, no decorator-triggered behavior, no convention-based magic. Verbose is correct. Terse is suspicious.

**Self-describing code.** Every feature, service, and schema carries machine-readable metadata. Descriptions on every input field. JSDoc on every schema column. Side effects declared before the logic. The codebase is its own documentation.

**Commits carry knowledge.** Every commit message should be descriptive enough that an agent reading `git log` understands what changed and why without looking at the diff. Use a clear subject line and a body that explains the reasoning, what files were affected, and any migration steps. For larger changes, point to a plan file. The commit history is how the local agent learns what happened while it wasn't watching — treat it as a knowledge transfer, not a formality. Load `.claude/skills/manifest-commit/SKILL.md` before committing.

**Know the why.** Before building a feature, understand why it exists — not just what it does. If the user asks for something and the motivation isn't clear, ask. The answer might change the approach, or reveal that the real need is different from the request. When you learn something that shifts the project's direction or clarifies its purpose, update `VISION.md`. This file is about *the app being built* — not about Manifest the framework. Keep it brief — a few sentences, not an essay. The vision should evolve with the project, not fossilize after day one.

**We build this together.** The codebase is a shared workspace — between you, the next agent, and the human. When you make a significant change, the ripple doesn't stop at the code. Ask yourself: does AGENTS.md still tell the truth? Are the skills still accurate? Does the config cover what was just added? Every significant change is a prompt to check that the rest of the system still makes sense. Load `.claude/skills/manifest-learn/SKILL.md` for the full reflection checklist. The goal is simple: no one should ever follow stale instructions because you forgot to update the map after moving the furniture.

**Your app watches itself.** Manifest applications are designed to be observed by AI. The Spark sidekick runs alongside your app — when a feature throws a 500, when an unhandled exception crashes a process, Spark captures the error with full context (stack trace, feature name, route, trace ID, request input) and stores it in a SQLite database. A Pi extension polls the database and injects events into the agent's conversation. In both development and production, Spark investigates and fixes issues — with full tool access. In production it acts with extra care: smallest surgical fix, no refactoring, transparent about every change. This isn't bolted on — it's baked into the server, the response envelope, and the framework's error handling. Every `request_id` in a response envelope doubles as a trace ID that Spark uses to connect errors back to requests. Spark runs as a web sidecar process with a browser dashboard on port 8081, watching your app and fixing issues autonomously. Build with the assumption that an agent is always watching.

**Share what works.** When you build something that could be useful to other Manifest projects, suggest packaging it as an extension. Extensions are how the Manifest ecosystem shares knowledge and working solutions.

## Your Codebase, Your Choices

Manifest has opinions about how features, schemas, and services are structured — that's the framework. It does **not** dictate how you build your application. You'll install npm packages. You'll make architectural decisions that aren't covered here. You'll do things your way.

That's fine. When you add things, just try to keep them explicit and self-explanatory. If you bring in a new library, make it clear what it does and why it's there. If you add a pattern, make sure someone reading the code for the first time can follow it without tribal knowledge. The principles above are a compass, not a cage.

## Branch Model

Manifest uses a two-branch model that separates the framework from your application:

```
manifest-upstream (GitHub remote)
  │
  │  git fetch manifest-upstream
  ▼
manifest (local branch — framework reference, read-only)
  │
  │  atomic diff (.manifest-sync tracks last synced hash)
  ▼
main (local branch — YOUR application)
  │
  │  git checkout -b feat/...
  ▼
feat/* / fix/* (feature branches for development work)
```

- **`manifest-upstream`** remote → points to the Manifest GitHub repo
- **`manifest`** branch → local copy of upstream, updated via fetch + fast-forward merge. Never commit app code here. Never force-push.
- **`main`** branch → your application. This is yours — develop here.
- **`feat/*`**, **`fix/*`** branches → feature work, branched off `main` as usual.

To update the framework from upstream, load the `manifest-update` skill. To contribute improvements back, load the `manifest-contribute` skill.

## Project Structure

```
├── VISION.md           # YOUR APP's soul. What you're building and why. Not about Manifest.
├── manifest/           # THE FRAMEWORK. Source code. Read it, modify it.
├── features/           # One file per behavior. This IS the application.
├── schemas/            # Drizzle ORM table definitions. One file per table.
├── services/           # Shared services. Plain exported functions.
├── policies/           # Authorization. One file per resource.
├── config/             # Typed config files. No YAML, no .env magic.
│   └── spark.ts        # Spark sidekick config: environment, DB, behavior.
├── extensions/         # Manifest extensions (each has EXTENSION.md).
│   └── spark/          # The Spark sidekick. Pi extension that polls SQLite for events.
│   └── spark-web/      # Spark web sidecar — browser dashboard with embedded Pi agent.
├── .pi/                # Pi agent configuration for this project.
│   └── settings.json   # Points Pi to the Spark extension.
├── .spark/             # Runtime artifacts (gitignored).
│   └── spark.db        # SQLite database — events, access logs, all Spark state.
├── tests/              # Mirrors features/ 1:1.
└── index.ts            # Entry point.
```

**Read AGENTS.md first** — it describes project conventions and what the codebase does. Then read the relevant feature files.

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
  rateLimit: { max: 100, windowSeconds: 60 },  // optional — omit to disable
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

### Rate Limiting

Features can declare an optional `rateLimit` to throttle requests per IP using a sliding window:

```typescript
rateLimit: { max: 100, windowSeconds: 60 },
```

- **`max`** — Maximum requests allowed within the window.
- **`windowSeconds`** — Sliding window duration in seconds.

The server enforces this automatically — no code needed in `handle()`. When exceeded, the client gets a `429 Too Many Requests` response with `Retry-After` and `X-RateLimit-*` headers in the standard Manifest envelope format. Spark receives a `rate-limit` event for observability. Omit `rateLimit` to disable (the default).

The rate limiter is in-memory (`services/rateLimiter.ts`) — counters reset on server restart. Keys are `${featureName}:${clientIP}`, so each feature has independent limits per IP.

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

Services are shared logic that multiple features (or scripts) can import. Plain exported objects with methods. No classes. No DI container. TypeScript's module system is the dependency injection.

### When to create a service

- **Two features need the same logic** → extract to a service
- **A build script has logic that could be reused** → extract to a service
- **You're writing a helper that isn't specific to one feature** → service

### When NOT to create a service

If the logic is only used in one feature, keep it inline. Don't create a service for a single call site. You can always extract later when a second consumer appears.

### Template

```typescript
import type { SomeType } from '../schemas/someSchema'

/**
 * Handles markdown parsing and rendering for blog content.
 * Used by blog-related features and the RSS feed generator.
 */
export const markdown = {
  /**
   * Parse raw markdown string into structured frontmatter and HTML body.
   * Returns null if the markdown is malformed or missing required frontmatter.
   */
  async parse(raw: string): Promise<{ frontmatter: Record<string, string>; html: string } | null> {
    // Implementation
  },

  /**
   * Render a blog post to full HTML with syntax highlighting and image optimization.
   * Throws if the post has not been parsed first.
   */
  async render(post: SomeType): Promise<string> {
    // Implementation
  },

  /**
   * Extract all image URLs from markdown content for prefetching.
   */
  extractImages(raw: string): string[] {
    // Implementation
  },
}
```

### Guidelines

- **JSDoc on every export** — describe what the function does, its parameters, and edge cases.
- **Pure functions preferred** — take input, return output. Minimize hidden state.
- **No classes** — use plain objects with methods.
- **Typed parameters** — use explicit types or interfaces, not `any`.
- **One responsibility per service** — a service does one thing well. `markdown` parses markdown. `mailer` sends email. Don't combine unrelated logic.
- **Features import services directly** — `import { markdown } from '../services/markdown'`. No registry, no DI.

## The Framework

The framework lives in `manifest/`. Read it:

| File | What it does |
|------|-------------|
| `types.ts` | Input type builders: `t.string()`, `t.integer()`, etc. |
| `validator.ts` | Validates input against schema. Formats, lengths, ranges. |
| `feature.ts` | `defineFeature()` and all feature types (request, stream, event). |
| `server.ts` | `Bun.serve()` wrapper. Route matching → rate limiting → validation → execution → envelope. SSE streaming. |
| `router.ts` | HTTP route matching with path parameters. |
| `envelope.ts` | Response formatting. `ok()`, `fail()`, `toEnvelope()`. |
| `scanner.ts` | Scans features directory and extensions, dynamically imports `.ts` files. |
| `testing.ts` | `createTestClient()` — call features by name without HTTP. Stream testing. |
| `frontend.ts` | `Bun.build()` wrapper, static file serving, live reload. |
| `index.ts` | Barrel export for framework types and utilities. |

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

### Troubleshooting section (required)

Every extension MUST include a `## Troubleshooting` section in its `EXTENSION.md`. This section is shown to agents when something breaks. Write it as step-by-step diagnostic checks — things an agent can run to figure out what went wrong and self-repair without asking for help.

Good troubleshooting entries include:
- **What can go wrong** — missing dependencies, misconfigured files, stale builds
- **How to detect it** — specific commands to run, files to check, error messages to look for
- **How to fix it** — exact commands or steps to restore a working state

Think of it as instructions for an agent that just encountered an error and needs to figure out why, without any human help.

## Extensions

Extensions live in `extensions/` and follow the same conventions. Each has an `EXTENSION.md`. The scanner picks up features from `extensions/*/features/`. Read an extension's `EXTENSION.md` before modifying it.

## Updating from Upstream

When the upstream Manifest repo adds new capabilities, the agent computes the aggregate diff since your last sync and applies it atomically:

1. **Fetch** — Pull upstream changes into your local `manifest` branch
2. **Diff** — Compute what changed between `.manifest-sync` hash and current upstream
3. **Review** — Show changes grouped by area, flag files modified on both sides
4. **Apply** — Single `git apply --3way` for the aggregate diff, one commit on `main`

The `.manifest-sync` file tracks which upstream commit you're synced to. Load the skill for the full flow:

```
Read and follow .claude/skills/manifest-update/SKILL.md
```

## Contributing Back

If you improve framework code in `manifest/` or skills, you can contribute those changes back to the upstream repo. The agent identifies framework-related commits on `main`, cherry-picks them onto a contribution branch off `manifest`, and opens a PR.

```
Read and follow .claude/skills/manifest-contribute/SKILL.md
```

## Spark — The Sidekick

Spark is what makes Manifest applications self-aware. It's not a separate tool you install — it's part of the framework's philosophy that your app should be observable by the same agents that build it.

### How It Works

Your Manifest server captures errors (500 responses, unhandled exceptions) and rate-limit violations and stores them in a SQLite database at `.spark/spark.db`. A Pi extension polls the database for unconsumed events and injects them into the agent's conversation. The database also stores HTTP access logs for observability.

The Spark web sidecar runs as a separate Bun process on its own port with the Pi SDK and Spark extension loaded. It survives main server crashes, so Spark can investigate even when your app is down.

### Starting Spark

Spark runs as a web sidecar alongside your app:

```bash
# Terminal 1: your app
bun run dev                                                        # bun --hot index.ts

# Terminal 2: Spark sidecar
SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts
```

1. Enable in `config/spark.ts`: set `web.enabled: true` and configure `SPARK_WEB_TOKEN`
2. Start the sidecar with the command above
3. Open `http://localhost:8081/` — enter your token at the login prompt

Authentication uses HttpOnly cookies — enter your token once and you're in for the session. You can load additional local extensions into the Spark agent via the `web.extensions` config array in `config/spark.ts`. See `extensions/spark-web/EXTENSION.md` for full docs.

For human interactive Pi sessions (not Spark), use `bunx pi` — it loads the Spark extension via `.pi/settings.json` and works as a full coding agent that also reacts to app errors. Read `extensions/spark/EXTENSION.md` for details.

### Environment Modes

| Environment | Tools | Behavior | Use Case |
|-------------|-------|----------|----------|
| `development` | Full (read, write, edit, bash) | **Fix** — investigate and repair | Local dev, active building |
| `production` | Full (read, write, edit, bash) | **Fix** — investigate and repair, with extreme care | Live systems, production incidents |

Configure in `config/spark.ts`. The environment resolves from `SPARK_ENV` → `NODE_ENV` → `'development'`. The config also includes a `web` block for the sidecar dashboard (`web.enabled`, `web.port`, `web.token`).

### Trace IDs

Every event carries a `traceId` that links back to the original request. For server errors, this is the same `request_id` from the response envelope — the ID the client sees. For unhandled errors, Spark generates a standalone trace ID. Follow the trace from client response → database event → agent investigation.

## When In Doubt

1. Read the source. The answers are in the code, not in assumptions.
2. Read `AGENTS.md` — it describes project conventions and what the codebase does.
3. Read the feature file — it's self-contained. Everything about a behavior is in one place.
4. Run `bun test` — verify things still work.
5. Read `git log` — the commit history explains what changed and why.


