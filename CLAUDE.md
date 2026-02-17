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

**We build this together.** The codebase is a shared workspace — between you, the next agent, and the human. When you make a significant change, the ripple doesn't stop at the code. Ask yourself: does AGENTS.md still tell the truth? Are the skills still accurate? Does MANIFEST.md reflect reality? Does the config cover what was just added? Every significant change is a prompt to check that the rest of the system still makes sense. Run `bun manifest learn` after large changes, or load `.claude/skills/manifest-learn/SKILL.md` for the full checklist. The goal is simple: no one should ever follow stale instructions because you forgot to update the map after moving the furniture.

**Commands are agent prompts.** Manifest CLI commands don't silently generate files — they output structured prompts that tell the agent exactly what to do. Scaffolding commands (`manifest feature make`, `manifest extension make`, `manifest extension install`) produce pure prompts: pre-context, instructions, and actionable steps. The agent reads the prompt and does the work. Work commands (`check`, `index`, `learn`) do their job but frame output as agent instructions — telling you what to fix, update, or verify. Commands may reference skills for deeper context. The CLI is the briefing; the agent is the executor.

**Your app watches itself.** Manifest applications are designed to be observed by AI. The Spark sidekick runs alongside your app — when a feature throws a 500, when an unhandled exception crashes a process, Spark captures the error with full context (stack trace, feature name, route, trace ID, request input) and delivers it to a Pi agent session. In both development and production, Spark investigates and fixes issues — with full tool access. In production it acts with extra care: smallest surgical fix, no refactoring, transparent about every change. This isn't bolted on — it's baked into the server, the response envelope, and the framework's error handling. Every `request_id` in a response envelope doubles as a trace ID that Spark uses to connect errors back to requests. Spark runs as a web sidecar process with a browser dashboard on port 8081, watching your app and fixing issues autonomously. Build with the assumption that an agent is always watching.

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
  │  interactive cherry-pick (agent-guided)
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
├── MANIFEST.md         # Auto-generated index. Read this to orient yourself.
├── manifest/           # THE FRAMEWORK. Source code. Read it, modify it.
├── features/           # One file per behavior. This IS the application.
├── schemas/            # Drizzle ORM table definitions. One file per table.
├── services/           # Shared services. Plain exported functions.
├── policies/           # Authorization. One file per resource.
├── commands/           # CLI commands.
├── config/             # Typed config files. No YAML, no .env magic.
│   └── spark.ts        # Spark sidekick config: environment, events, behavior.
├── extensions/         # Manifest extensions (each has EXTENSION.md).
│   └── spark/          # The Spark sidekick. Event bus + Pi extension.
│   └── spark-web/      # Spark web sidecar — browser dashboard with embedded Pi agent.
├── .pi/                # Pi agent configuration for this project.
│   └── settings.json   # Points Pi to the Spark extension.
├── .spark/             # Runtime artifacts (gitignored).
│   ├── events/         # Event files — the bus between your app and Spark.
│   ├── agents/         # Agent presence files — tracks active Pi sessions.
│   └── pause           # Pause file — signals "I'm working, back off."
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

Use `bun manifest service make <Name>` to scaffold a new service file with the correct structure.

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

## CLI Commands

**Start here.** Run `bun manifest status` when you first arrive at the project. It tells you what's healthy, what's stale, and what needs attention — in seconds.

### Which Command When

| Situation | Command | What it does |
|-----------|---------|-------------|
| **Just arrived at this codebase** | `bun manifest status` | Quick pulse check — features, health, git, Spark, staleness |
| **Something is broken** | `bun manifest doctor` | Deep diagnostics — imports every feature, checks config, shows extension troubleshooting |
| **After making changes** | `bun manifest learn` | Scans for staleness — MANIFEST.md drift, AGENTS.md accuracy, missing tests |
| **Before committing** | `bun manifest check` | Convention validator — descriptions, sideEffects, routes, input fields |
| **MANIFEST.md is stale** | `bun manifest index` | Regenerates MANIFEST.md from current features, extensions, and CLI commands |

### All Commands

```bash
# Quick start
bun manifest status                       # Project health at a glance (start here)
bun --hot index.ts                        # Start server with hot reload
bun test                                  # Run all tests

# Validation & diagnostics
bun manifest check                        # Validate conventions
bun manifest index                        # Rebuild MANIFEST.md
bun manifest learn                        # Check for staleness after changes
bun manifest doctor                       # Diagnose system issues

# Scaffolding (outputs agent prompts — no files written)
bun manifest feature make <Name>          # Scaffold a new feature
bun manifest extension make <name>        # Scaffold a new extension
bun manifest extension install <src>      # Install an extension from GitHub or npm
bun manifest extension list               # List installed extensions

# Frontend
bun manifest frontend install             # Choose and install a frontend preset
bun manifest frontend build               # Build frontend for production
bun manifest frontend dev                 # Start standalone frontend watcher

# Process runner
bun manifest run <command> [args...]      # Run with logging + Spark error reporting
bun manifest run dev                      # Sugar for: bun --hot index.ts

# Spark sidekick
bun manifest spark init                   # Set up Spark (config + Pi extension)
bun manifest spark status                 # Show Spark state
bun manifest spark pause "reason"         # Tell Spark to back off
bun manifest spark resume                 # Let Spark process events again
```

### Spark Commands

### Starting Spark

Spark runs as a web sidecar process alongside your app. It uses the Pi SDK with the Spark extension loaded, running entirely on Bun.

```bash
# Terminal 1: your app
bun --hot index.ts

# Terminal 2: Spark sidecar
SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts
```

1. Enable in `config/spark.ts`: set `web.enabled: true` and `SPARK_WEB_TOKEN`
2. Start the sidecar with the command above
3. Open `http://localhost:8081/` — you'll see a login prompt where you enter your token

The sidecar runs as a separate process on its own port — it watches `.spark/events/`, runs a health assessment on startup, and begins responding to errors from your running app. **It survives main server crashes**, so you can still talk to Spark and investigate what happened even if your app goes down. Authentication uses HttpOnly cookies — enter your token once at the login prompt and you're in for the session. You can load additional local extensions into the Spark agent via the `web.extensions` config array in `config/spark.ts`. See `extensions/spark-web/EXTENSION.md` for full docs.

For human interactive Pi sessions (not Spark), use `bunx pi` — it loads the Spark extension via `.pi/settings.json` and works as a full coding agent that also reacts to app errors. Read `extensions/spark/EXTENSION.md` for details.

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
| `cli/` | CLI commands: status, serve, index, check, learn, doctor, make:feature, extension (make/install/list), frontend, spark, run. Each command exports `meta` for self-documentation. |

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

When the upstream Manifest repo adds new capabilities, you cherry-pick what you want:

1. **Fetch** — Pull upstream changes into your local `manifest` branch
2. **Review** — The agent reads new commits and groups them by area (framework, CLI, skills, docs)
3. **Recommend** — The agent suggests which batches to pick or skip, with reasoning
4. **Cherry-pick** — Selected commits are applied to `main`, with conflict resolution

This is deliberate — you control what enters your application. Load the skill for the full flow:

```
Read and follow .claude/skills/manifest-update/SKILL.md
```

## Contributing Back

If you improve framework code in `manifest/`, CLI commands, or skills, you can contribute those changes back to the upstream repo. The agent identifies framework-related commits on `main`, cherry-picks them onto a contribution branch off `manifest`, and opens a PR.

```
Read and follow .claude/skills/manifest-contribute/SKILL.md
```

## Spark — The Sidekick

Spark is what makes Manifest applications self-aware. It's not a separate tool you install — it's part of the framework's philosophy that your app should be observable by the same agents that build it.

### How It Works

Your Manifest server captures errors (500 responses, unhandled exceptions) and rate-limit violations and writes them as JSON event files to `.spark/events/`. A Pi extension watches that directory and injects events into the agent's conversation. The connection is a plain directory of files — no sockets, no message queues, no dependencies.

The Spark web sidecar runs as a separate Bun process on its own port with the Pi SDK and Spark extension loaded. It survives main server crashes, so Spark can investigate even when your app is down.

### Environment Modes

| Environment | Tools | Behavior | Use Case |
|-------------|-------|----------|----------|
| `development` | Full (read, write, edit, bash) | **Fix** — investigate and repair | Local dev, active building |
| `production` | Full (read, write, edit, bash) | **Fix** — investigate and repair, with extreme care | Live systems, production incidents |

Configure in `config/spark.ts`. The environment resolves from `SPARK_ENV` → `NODE_ENV` → `'development'`. The config also includes a `web` block for the sidecar dashboard (`web.enabled`, `web.port`, `web.token`).

### Pause/Resume Protocol

When you (or another agent) are actively making changes, tell Spark to hold off:

```bash
bun run manifest spark pause "refactoring auth flow"
# ... make changes ...
bun run manifest spark resume
```

While paused, Spark buffers events but doesn't act on them. When resumed, it reviews buffered events and acts on anything still relevant. If a pause goes stale (>30 minutes), Spark clears it on next startup and runs a doctor check to assess the damage.

**This matters for multi-agent workflows.** If you're using Claude Code, Cursor, or any other agent alongside Spark, have that agent run `spark pause` before making changes. This prevents Spark from reacting to transient errors caused by in-progress work.

### Trace IDs

Every event carries a `traceId` that links back to the original request. For server errors, this is the same `request_id` from the response envelope — the ID the client sees. For unhandled errors, Spark generates a standalone trace ID. Follow the trace from client response → event file → agent investigation.

## When In Doubt

1. Run `bun manifest status` — quick health check, shows what needs attention.
2. Read the source. The answers are there.
3. Read `MANIFEST.md` — it's the index of everything (features, extensions, CLI commands).
4. Read the feature file — it's self-contained.
5. Run `bun manifest check` — it validates conventions.
6. Run `bun manifest doctor` — deep diagnostics when something is broken.
7. Read `git log` — the commit history explains what changed and why.

## Process Runner

Use `bun manifest run` to wrap commands. This logs all output to `.spark/logs/` and emits a Spark event if the command fails — so agents get notified about build failures, test failures, and crashes automatically.

```bash
bun manifest run bun test              # Run tests with Spark monitoring
bun manifest run dev                   # Sugar for: bun --hot index.ts
bun manifest run bun install           # Any command works
```

**When to use it:**
- Running tests, builds, or any command where failure matters
- Starting the dev server (long-running — output streams to log)
- Any command where you want Spark to catch failures

**When NOT to use it:**
- Quick one-shot commands like `git status`, `ls`, `cat`
- Commands that need interactive input (the runner pipes but doesn't provide a tty)

**Sugar shortcuts:**
| Short | Expands to |
|-------|-----------|
| `manifest run dev` | `bun --hot index.ts` |

Logs are written to `.spark/logs/<command>-YYYY-MM-DD-HHmmss.log`. Run `bun manifest doctor` to see recent logs.
