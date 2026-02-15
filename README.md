# Manifest

> *Production is our dev environment.*

The first framework where the agent isn't using the framework — it **is** the framework. Manifest is source code the whole way down. No npm package, no hidden runtime, no abstractions the agent can't read. The framework ships inside your project as ~1,000 lines of TypeScript that the agent wrote, understands, and evolves alongside your application.

Built on Bun. No build step. No magic.

```
bun --hot index.ts
```

That's the entire deployment. The agent edits a file, Bun hot-reloads it, the next request runs the new code. In production.

---

## Why Manifest Exists

Every framework today was designed for humans to write code and machines to run it. Manifest inverts this. It's designed for **agents to write code, read code, and fix code** — with humans steering.

The problem with existing frameworks:

- **Next.js** hides behavior behind file-system conventions, bundler transforms, and server/client boundaries that even experienced developers struggle to trace. An agent has no chance.
- **Express/Fastify** scatter a single behavior across routes, middleware, validators, error handlers, and services. To understand one endpoint, you need to read six files and know the registration order.
- **NestJS** wraps everything in decorators and dependency injection. The actual execution flow is invisible — it lives in the framework's reflection metadata, not in your code.
- **Laravel/Rails** rely on convention-over-configuration so heavily that understanding what happens on a request requires knowing the framework's internals by heart.

These frameworks optimize for developer ergonomics. Manifest optimizes for **agent comprehension**. It turns out these are the same thing — explicit code that you can read linearly is good for everyone.

---

## The Three Rules

**1. One feature, one file.**

A feature file contains everything: route, input validation, authentication, business logic, side effects, error cases. No hunting across directories. An agent reads one file and knows everything about one behavior.

**2. Explicit over elegant.**

If something happens, it's because the code says so. Not because a middleware was auto-discovered, a decorator triggered a side effect, or a bundler rewrote your imports. Verbose is correct. Terse is suspicious.

**3. Self-describing code.**

Every feature carries machine-readable metadata: what it does, what it depends on, what it affects. The codebase is its own documentation. An agent dropping in cold reads `MANIFEST.md` and orients itself in seconds.

---

## What a Feature Looks Like

```typescript
// features/UserRegistration.ts
import { defineFeature, t } from '../manifest'
import { db } from '../config/database'
import { users } from '../schemas/users'
import { mailer } from '../services/mailer'
import { eq } from 'drizzle-orm'

export default defineFeature({
  name: 'user-registration',
  description: `Creates a new user account. Validates email uniqueness,
                hashes password, persists user, and sends a welcome email.
                Returns the created user without sensitive fields.`,
  route: ['POST', '/api/users/register'],
  authentication: 'none',
  rateLimit: '5/minute/ip',
  sideEffects: [
    'Inserts one row into users table',
    'Sends welcome email via mailer service',
  ],
  errorCases: [
    '409 - Email already registered',
    '422 - Validation failed',
  ],

  input: {
    email: t.string({
      description: 'User email address. Must be unique across all users.',
      required: true,
      format: 'email',
    }),
    password: t.string({
      description: 'Account password. Hashed with argon2 before storage.',
      required: true,
      minLength: 8,
      maxLength: 128,
    }),
    displayName: t.string({
      description: 'Public display name shown to other users.',
      required: true,
      maxLength: 100,
    }),
  },

  async handle({ input, ok, fail }) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing.length > 0) {
      return fail('Email already registered', 409)
    }

    const [user] = await db.insert(users).values({
      email: input.email,
      password: await Bun.password.hash(input.password),
      displayName: input.displayName,
    }).returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })

    await mailer.send({
      template: 'welcome',
      to: user.email,
      context: { displayName: user.displayName },
    })

    return ok('User registered', { data: user, status: 201 })
  },
})
```

From this single file, an agent knows:
- What the feature does and why (description)
- What URL triggers it (route, method, auth, rate limit)
- Every input field with types, constraints, and purpose
- Every side effect, declared before the logic
- Every error case with HTTP status codes
- The full execution flow — linear, no hidden branches
- All dependencies via explicit imports at the top

No base classes. No decorators. No inheritance. The plain object **is** the feature.

---

## The Framework Is Source Code

Most frameworks are black boxes behind `node_modules/`. Manifest is different:

```
manifest/
├── server.ts        # Bun.serve() wrapper — 109 lines
├── feature.ts       # defineFeature() — 83 lines
├── types.ts         # t.string(), t.integer(), etc. — 141 lines
├── validator.ts     # Input validation — 92 lines
├── router.ts        # HTTP route matching — 76 lines
├── envelope.ts      # Response formatting — 65 lines
├── scanner.ts       # Feature directory scanner — 33 lines
├── testing.ts       # Test client — 73 lines
├── index.ts         # Barrel exports — 31 lines
└── cli/             # serve, index, check, make:feature — 352 lines
```

**1,055 lines total.** An agent reads the entire framework in seconds. It doesn't just use Manifest — it *understands* Manifest. When something breaks, the agent doesn't search Stack Overflow. It reads `manifest/router.ts` (76 lines) and fixes the routing. It reads `manifest/validator.ts` (92 lines) and adds a new validation rule.

The agent builds the framework as it builds the application. They're the same codebase. There is no boundary between "framework code" and "application code" — just code the agent wrote, reads, and evolves.

---

## How It Works

### Start the server

```typescript
// index.ts
import { createManifestServer } from './manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: 8080,
})
```

Under the hood: scan `features/` → build route table → start `Bun.serve()`. That's it. No initialization ceremony, no providers, no bootstrapping phase.

### Every response is predictable

```json
{
  "status": 201,
  "message": "User registered",
  "data": {
    "id": "a1b2c3",
    "email": "user@example.com",
    "displayName": "Jane"
  },
  "meta": {
    "feature": "user-registration",
    "request_id": "req_xyz789",
    "duration_ms": 42
  }
}
```

Every response includes `meta.feature` — when something breaks, the agent knows exactly which file to open.

### Test without HTTP

```typescript
import { createTestClient } from '../manifest/testing'

const client = createTestClient({ featuresDir: './features' })
const result = await client.call('user-registration', {
  email: 'jane@example.com',
  password: 'secure-password-123',
  displayName: 'Jane',
})

expect(result.status).toBe(201)
```

Call features by name. No HTTP overhead. No port conflicts. Fast, deterministic tests.

### MANIFEST.md — The Agent's Entry Point

Every Manifest project has a `MANIFEST.md` at the root. Auto-generated. Always in sync. It's the first thing any agent reads:

```markdown
## Feature Index
| Name | Route | Type | Description |
|------|-------|------|-------------|
| user-registration | POST /api/users/register | request | Creates new account |
| user-login | POST /api/users/login | request | Authenticates user |
| post-feed | GET /api/posts/feed | stream | Real-time post stream |
```

```bash
bun run manifest index    # Regenerate MANIFEST.md
bun run manifest check    # Validate conventions
```

---

## The Agentic Loop

This is what Manifest is built for:

```
Error tracker fires alert
        ↓
Agent reads MANIFEST.md → orients
        ↓
Agent reads the feature file → understands the full behavior
        ↓
Agent reads manifest/validator.ts → understands how validation works
        ↓
Agent edits the feature file → fixes the bug
        ↓
Bun hot-reloads → new code is live
        ↓
Agent commits with [agent] prefix → traceable
        ↓
Next request works
```

No deploy. No CI. No restart. The agent edits a `.ts` file and it's live. Because there's no build step. Because Bun runs TypeScript natively. Because `--hot` reloads modules without dropping connections.

Every design decision in Manifest exists to make this loop fast, safe, and reliable:

- **One file per feature** → the agent edits one file, not six
- **Explicit side effects** → the agent knows the blast radius before touching anything
- **Machine-readable metadata** → the agent doesn't guess, it reads
- **Source-code framework** → the agent can fix the framework itself
- **No hidden behavior** → the agent's mental model matches reality

---

## Project Structure

```
manifest-app/
├── MANIFEST.md             # Auto-generated. The agent reads this first.
├── manifest/               # THE FRAMEWORK. Source code. ~1,000 lines.
├── features/               # One file per behavior. This IS the app.
│   ├── UserRegistration.ts
│   ├── UserLogin.ts
│   └── ListPosts.ts
├── schemas/                # Drizzle ORM. One file per table.
├── services/               # Plain exported functions. No DI container.
├── config/                 # Typed TypeScript. No YAML, no .env magic.
├── tests/                  # Mirrors features/ 1:1.
├── index.ts                # Entry point. 4 lines.
└── package.json
```

The `features/` directory **is** the application. Everything else is infrastructure.

---

## Technical Foundation

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Native TypeScript, built-in HTTP server, hot reload, test runner, password hashing — all in one binary |
| Language | **TypeScript (strict)** | Type safety without a compilation step on Bun |
| ORM | **Drizzle** | SQL-like, explicit, TypeScript-native. What you write is what runs |
| API style | **JSON REST + SSE** | No GraphQL complexity. Predictable envelopes |
| Build step | **None** | `.ts` files run directly. The source code is the production code |
| Framework | **Source code** | Not a dependency. Lives in `manifest/`. The agent can read and modify every line |

### Why Not [Other Framework]?

| Framework | Problem for agents |
|-----------|-------------------|
| Next.js | File-system routing, bundler transforms, server/client split — too much hidden behavior |
| Express | Middleware chains, scattered route handlers — one behavior spans many files |
| NestJS | Decorators, DI containers, reflection — execution flow is invisible |
| Hono | Better than Express, but still middleware-based — agent can't see the full picture in one file |
| Elysia | Decorator-heavy, method chaining — behavior emerges from composition, not declaration |

Manifest has no middleware. No decorators. No DI container. No file-system routing. No convention-based auto-discovery. Every behavior is a `defineFeature()` call in a single file that the agent reads top to bottom.

---

## CLI

```bash
bun run manifest serve              # Start server (use bun --hot for live reload)
bun run manifest index              # Regenerate MANIFEST.md
bun run manifest check              # Validate conventions
bun run manifest make:feature Name  # Scaffold a new feature
```

The CLI is 352 lines of TypeScript. No framework. Just `process.argv`.

---

## Getting Started

### The fast way (with an AI agent)

Paste this into your agent:

> Download and follow the steps from https://github.com/hazat/manifest/blob/main/SPARK.md

Your agent becomes **Spark** — a Manifest onboarding guide that walks you through forking, setting up, and building your first feature step by step.

### The manual way

```bash
# 1. Fork https://github.com/hazat/manifest on GitHub
# 2. Clone your fork:
git clone https://github.com/YOU/manifest.git my-app
cd my-app
bun install

# Start developing
bun --hot index.ts

# In another terminal
curl http://localhost:8080/api/hello?name=World
```

```json
{
  "status": 200,
  "message": "Hello, World!",
  "data": { "greeting": "Hello, World!" },
  "meta": { "feature": "hello-world", "request_id": "...", "duration_ms": 0.42 }
}
```

### Create a new feature

```bash
bun run manifest make:feature CreatePost --route="POST /api/posts" --auth=required
```

This scaffolds `features/CreatePost.ts` with the full structure and TODO markers. Fill in the blanks.

### Run tests

```bash
bun test
```

45 tests across the framework and application. All using Bun's built-in test runner.

---

## Fork It. It's Yours.

Manifest doesn't install from npm. You fork the repo and start building.

```bash
# Fork on GitHub, then:
git clone https://github.com/you/manifest-app my-project
cd my-project
bun install
bun --hot index.ts
```

The `manifest/` directory is now **your** framework. Your agent reads it, modifies it, extends it as the application grows. There's no upstream dependency to keep in sync, no version pinning, no breaking changes from a package update.

This is intentional. Traditional frameworks maintain a boundary: framework code lives in `node_modules/`, application code lives in `src/`. You depend on the framework. You can't change it. When it breaks, you wait for a patch.

Manifest erases that boundary. The 1,055 lines of framework code live in your project, committed to your repo, understood by your agent. When the router needs a new matching rule, the agent edits `manifest/router.ts`. When validation needs a new format, the agent edits `manifest/validator.ts`. No pull request to an upstream repo. No waiting.

**What about upstream improvements?**

When the Manifest base repo adds a new capability — say, SSE streaming support — you don't `git merge`. Your agent reads the upstream diff, understands the intent, and implements the idea in the context of what your project has become. That's how agents work. They don't need `git merge`, they need context. The upstream repo serves as a reference and inspiration, not a dependency.

---

## Extensions

Extensions are shared functionality that follows Manifest conventions. Authentication, payment processing, email — things many projects need and shouldn't reinvent.

An extension is just a directory of features, schemas, and services. No plugin API. No hooks. No registration. Just more files following the same rules.

```
extensions/
├── auth/
│   ├── EXTENSION.md              # Agent reads this to understand the extension
│   ├── features/
│   │   ├── Login.ts              # Standard defineFeature() — same as any feature
│   │   ├── Register.ts
│   │   ├── RefreshToken.ts
│   │   └── ResetPassword.ts
│   ├── schemas/
│   │   └── sessions.ts           # Standard Drizzle schema
│   └── services/
│       └── jwt.ts                # Plain exported functions
│
├── stripe/
│   ├── EXTENSION.md
│   ├── features/
│   │   ├── CreateCheckout.ts
│   │   └── HandleWebhook.ts
│   └── services/
│       └── stripe.ts
```

### Adding an extension

```bash
# Clone into extensions/
cd extensions
git clone https://github.com/manifest-ext/auth

# Rebuild the manifest
bun run manifest index
```

That's it. The scanner picks up features from `extensions/*/features/`. They show up in `MANIFEST.md`. They follow the same conventions. `bun manifest check` validates them the same way.

### EXTENSION.md

Every extension has an `EXTENSION.md` — the agent's guide to the extension, like `MANIFEST.md` is the guide to the app:

```markdown
# Auth Extension

Provides user authentication with JWT tokens and session management.

## Features
| Name | Route | Description |
|------|-------|-------------|
| login | POST /api/auth/login | Authenticates user, returns JWT |
| register | POST /api/auth/register | Creates account |
| refresh-token | POST /api/auth/refresh | Refreshes expired JWT |

## Schemas
- sessions: Active JWT sessions with expiry tracking

## Services
- jwt: Token signing and verification (RS256)

## Configuration Required
Add to config/manifest.ts:
  jwtSecret: Bun.env.JWT_SECRET
  jwtExpirySeconds: 3600

## Side Effects
- Inserts/updates sessions table
- No external API calls
```

### Why this works

Extensions follow the same three rules:

1. **One feature, one file.** An auth extension's `Login.ts` is a complete, self-contained feature — same as any feature you write yourself.
2. **Explicit over elegant.** No auto-registration, no decorator scanning. The scanner reads the directory. You can see what's loaded.
3. **Self-describing.** `EXTENSION.md` tells the agent everything. No reading source code to understand what an extension provides.

And because extensions are source code in your project, your agent can modify them too. If the auth extension's password policy doesn't fit your needs, the agent edits `extensions/auth/features/Register.ts`. It's just a file.

---

## The Vision

Manifest is not a framework for writing web applications. It's a framework for **agents** writing web applications.

The distinction matters. When an agent is the primary author:

- **Code must be self-describing.** Not through comments, but through structure. Every feature declares its purpose, its inputs, its side effects, its error cases — as data, not as documentation that drifts.

- **The framework must be transparent.** An agent that can't read the framework can't fix the framework. Manifest is 1,055 lines of source code in your project. The agent has read every line. It wrote most of them.

- **Hot reload must be real.** Not "restart the process" real. Module-level hot swap real. The agent patches a file and the next request uses the new code. No deploy pipeline. No container rebuild. Edit → live.

- **The project must be self-contained.** No hidden behavior in `node_modules`. No framework version upgrades that change semantics. The framework evolves with the application because they're the same codebase.

Traditional frameworks ask: *"How do we make developers productive?"*

Manifest asks: *"How do we make the codebase fully comprehensible to an agent that can read, write, and deploy code in a single loop?"*

The answer turns out to be the same things good engineering has always valued: explicitness, small files, declared dependencies, no magic. Manifest just takes it seriously.

---

## Status

Manifest is in early development. The core framework is complete:

- ✅ Feature system (`defineFeature`, typed inputs, `ok`/`fail` helpers)
- ✅ Input validation (types, formats, constraints)
- ✅ HTTP server (Bun.serve, routing, path params, JSON envelopes)
- ✅ Test client (call features by name, no HTTP)
- ✅ CLI (serve, index, check, make:feature)
- ✅ MANIFEST.md generation
- ✅ Convention validation

Coming next:
- ⬜ Drizzle ORM integration (schemas, migrations)
- ⬜ Authentication & authorization
- ⬜ Rate limiting
- ⬜ SSE streaming features
- ⬜ Event-triggered features
- ⬜ Agent sidecar (error tracking integration, self-healing loop)
- ⬜ Docker deployment

---

<p align="center">
  <em>Production is our dev environment.</em>
</p>
