# Roadmap

> What's done, what's next, what's on the horizon.

Last updated: 2026-02-15

---

## ✅ Phase 0: Foundation (done)

The core framework exists and works end-to-end.

- [x] `defineFeature()` with typed inputs, `ok`/`fail` helpers, metadata
- [x] Input type builders (`t.string`, `t.integer`, `t.number`, `t.boolean`, `t.array`)
- [x] Input validation (required, format, length, range)
- [x] HTTP server on `Bun.serve()` with route matching and path parameters
- [x] Response envelope with `meta.feature`, `request_id`, `duration_ms`
- [x] Feature scanner (dynamic import from `features/` directory)
- [x] Test client (`createTestClient` — call features by name, no HTTP)
- [x] CLI: `serve`, `index`, `check`, `make:feature`
- [x] `MANIFEST.md` auto-generation
- [x] Convention validation
- [x] `CLAUDE.md` / `AGENTS.md` agent context
- [x] `SPARK.md` one-paste onboarding guide
- [x] 45 tests, 0 TypeScript errors

---

## ✅ Frontend Support (done)

Built-in frontend support with preset extensions and Bun-native tooling.

- [x] Static file serving from `dist/` as fallback after API routes
- [x] `Bun.build()` wrapper with source maps always on
- [x] Live reload in dev mode via SSE (`/__dev/reload`)
- [x] CLI commands: `manifest frontend install/build/dev`
- [x] **Static preset** — HTML + Tailwind CSS + vanilla TypeScript
- [x] **Reactive preset** — SolidJS + Tailwind CSS + JSX
- [x] `manifest-frontend` agent skill
- [x] Spark integration (Step 3: Choose Your Stack)
- [ ] **Full SPA preset** — Vite-based with client-side routing (future)

---

## 🔨 Phase 1: Real Applications

What you need to build something beyond HelloWorld. This turns Manifest from a framework demo into something you'd ship.

### Database (Drizzle ORM integration)

- [ ] Database connection setup in `config/database.ts` (PostgreSQL + SQLite for dev)
- [ ] Schema scaffolding: `bun manifest make:schema <Name>`
- [ ] Example schema with JSDoc descriptions on every column
- [ ] Migration generation via `drizzle-kit`
- [ ] Database access helper (typed `db` object features import)
- [ ] Test database setup (SQLite in-memory for fast tests)
- [ ] `createTestClient` gets `client.database` for inspecting rows in tests

### Authentication & Authorization

- [ ] JWT token signing and verification service
- [ ] `authentication: 'required'` actually enforced by the server
- [ ] `HandleContext` gets a `user` object when authenticated
- [ ] Token extraction from `Authorization: Bearer <token>` header
- [ ] Policy files in `policies/` — one per resource, explicit authorization checks
- [ ] Example: `UserLogin` and `UserRegistration` features with password hashing

### Rate Limiting

- [ ] Rate limit enforcement in the server request handler
- [ ] In-memory driver (default) and Redis driver
- [ ] `rateLimit: '5/minute/ip'` expression parsing
- [ ] Rate limit headers in responses (`X-RateLimit-Remaining`, etc.)

### Additional CLI Commands

- [ ] `bun manifest make:schema <Name>` — scaffold a Drizzle schema
- [ ] `bun manifest make:test <FeatureName>` — scaffold a test for an existing feature
- [ ] `bun manifest make:service <Name>` — scaffold a service
- [ ] `bun manifest db:migrate` — run pending migrations
- [ ] `bun manifest db:seed` — run seed files

### Server Hardening

- [ ] CORS configuration
- [ ] Health check endpoint (`GET /health`)
- [ ] Graceful shutdown (finish in-flight requests, close DB connections)
- [ ] Structured logging (JSON logs with feature name, request ID, duration)
- [ ] Request body size limits

---

## 🔨 Phase 2: Real-Time & Events

### SSE Streaming

- [ ] `type: 'stream'` features with `stream()` handler instead of `handle()`
- [ ] `emit()` helper for sending events to connected clients
- [ ] Heartbeat keepalive (configurable interval)
- [ ] Connection timeout (configurable max duration)
- [ ] Client reconnection support (`Last-Event-ID`)

### Event-Triggered Features

- [ ] `type: 'event'` features with `trigger: 'event.name'`
- [ ] Internal event bus (in-process, explicit)
- [ ] Features can emit events: `emit('order.shipped', payload)`
- [ ] Event features execute in response — same `handle()` pattern
- [ ] Events are traceable in logs with the originating request ID

---

## 🔨 Phase 3: Extensions Ecosystem

The extension system is designed in the README. Now build it.

### Extension Scanner

- [ ] Scanner reads `extensions/*/features/` in addition to `features/`
- [ ] Scanner reads `extensions/*/schemas/` and `extensions/*/services/`
- [ ] `MANIFEST.md` includes extension features in the index
- [ ] `bun manifest check` validates extension features same as app features
- [ ] `EXTENSION.md` format specification

### Extension CLI

- [ ] `bun manifest add:extension <repo>` — clone into `extensions/`
- [ ] `bun manifest list:extensions` — show installed extensions
- [ ] `bun manifest remove:extension <name>` — remove an extension directory

### First-Party Extensions

- [ ] `manifest-ext/auth` — JWT authentication, login, register, refresh, password reset
- [ ] `manifest-ext/uploads` — File upload handling with S3/local storage
- [ ] `manifest-ext/email` — Transactional email with template support
- [ ] `manifest-ext/webhooks` — Outgoing webhook delivery with retry logic

---

## 🔨 Phase 4: Agent Skills

Skills are prompt files that teach agents how to work with Manifest effectively. They're the bridge between the framework's conventions and an agent's ability to follow them.

### Codebase Navigation Skills

- [ ] **`manifest-navigate`** — How to orient in a Manifest project. Read MANIFEST.md first, then the relevant feature file, then trace imports. Teaches the agent the reading order.
- [ ] **`manifest-debug`** — How to debug a failing feature. Read the error, find the feature via `meta.feature`, read the feature file, trace the issue, fix it, run the test.
- [ ] **`manifest-trace`** — How to trace a request end-to-end. From the route to the router to the feature to the database. Follow imports, read the framework source if needed.

### Code Authoring Skills

- [ ] **`manifest-feature`** — How to write a new feature. The full pattern: scaffold, describe, define inputs, declare side effects, implement handle, write test, update manifest.
- [ ] **`manifest-schema`** — How to write a Drizzle schema. JSDoc on every column, relations explicit, hidden fields declared.
- [ ] **`manifest-test`** — How to write tests. Use `createTestClient`, test the happy path, test validation, test each error case. One test file per feature.
- [ ] **`manifest-service`** — How to write a shared service. Plain exports, no classes, no DI. Document what it does and who uses it.

### Production Skills

- [ ] **`manifest-deploy`** — How to build the Docker image, configure environment variables, set up the two-branch workflow.
- [ ] **`manifest-hotfix`** — How to fix a production issue. Read the error, read the feature, fix the code, hot-reload picks it up, commit with `[agent]` prefix.
- [ ] **`manifest-review`** — How to review changes in a Manifest project. Check that features are self-contained, side effects are declared, inputs have descriptions, tests exist.

---

## 🔨 Phase 5: Production Agent

This is the endgame. An AI agent running as a sidecar in production, monitoring the application and fixing issues in real-time.

### Docker Deployment

- [ ] `Dockerfile` — Bun base image, `bun install --production`, `bun --hot index.ts`
- [ ] `docker-compose.yml` — App + PostgreSQL + Redis
- [ ] Environment variable documentation
- [ ] Container health checks

### Two-Branch Git Workflow

- [ ] `main` branch — human development
- [ ] `production` branch — deployed code, agent works here
- [ ] Human merges `main → production` to deploy
- [ ] Agent only pushes to `production`, never touches `main`
- [ ] Branch protection rules documentation

### Agent Sidecar

- [ ] Agent process runs alongside the app in the same container
- [ ] Reads structured logs for errors and anomalies
- [ ] Error tracker integration (Sentry, Bugsnag, or custom) — pluggable
- [ ] When an error is detected: read MANIFEST.md → find the feature → read the feature file → diagnose → fix → hot-reload → commit
- [ ] All agent commits prefixed with `[agent]` and structured:
  ```
  [agent] fix: Null check in UserRegistration
  
  Error Tracker Issue: MYAPP-1234
  Root cause: input.displayName could be undefined when OAuth omits name.
  Side effects of this fix: None.
  Features modified: user-registration
  Risk: Low
  ```

### Agent Memory & Context

- [ ] Memory file (`agent-memory.md`) persisted in git — what the agent knows, recent fixes, patterns observed
- [ ] On container restart: agent reads memory file, reads MANIFEST.md, diffs what changed since last boot
- [ ] Graceful shutdown: agent gets 30s to commit work-in-progress and update memory file
- [ ] Agent changelog: `bun manifest agent:changelog` shows what the agent changed since last human release

### Agent Guardrails

- [ ] Agent can only push to configured branches
- [ ] Agent cannot force-push or delete branches
- [ ] Agent cannot run migrations (schema changes are human-authored)
- [ ] Agent cannot modify CI/CD pipelines or secrets
- [ ] Filesystem access limited to project directory
- [ ] Network access limited to git remote + error tracker API
- [ ] Dedicated SSH key / deploy key with minimal permissions
- [ ] If a fix breaks tests, the agent reverts and flags for human review
- [ ] Merge conflicts → agent stops and flags for human resolution

### Observability

- [ ] Agent dashboard: what the agent has fixed, when, confidence level
- [ ] Alert when the agent can't fix something (needs human)
- [ ] Audit log of all agent commits with diffs
- [ ] Metrics: mean time to agent fix, fix success rate, revert rate

---

## 🌊 Phase 6: Things We're Thinking About

Not committed to. Exploring.

- **OpenAPI generation** — Every feature already declares its route, inputs, and responses. Generating an OpenAPI spec from feature definitions is natural. `bun manifest openapi` could produce a spec file.
- **Multi-tenancy primitives** — Tenant isolation at the feature level. `HandleContext` gets a `tenant` object. Database queries automatically scoped.
- **WebSocket features** — Beyond SSE. Bidirectional real-time with the same self-describing pattern.
- **Feature versioning** — `route: ['GET', '/api/v2/users']` is fine, but should the framework help with API versioning more explicitly?
- **Agent collaboration** — Multiple agents working on the same codebase. One monitors errors, another handles feature requests. Coordination via git.
- **Visual testing** — Agent takes screenshots of frontend consuming the API, compares against baseline, flags regressions.

---

## Principles for the Roadmap

Every item on this roadmap must pass these tests:

1. **Does it keep things explicit?** If it adds hidden behavior, it doesn't belong.
2. **Can an agent read and understand it?** If it requires framework-internal knowledge that isn't in the source code, redesign it.
3. **Is it source code?** If it hides behind `node_modules/`, find another way.
4. **Does it fit in one file?** If a feature needs to know about something in another file that isn't an explicit import, the design is wrong.
5. **Would we rather not have it?** If the answer is "we could live without it," don't build it yet.
