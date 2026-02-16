# Roadmap

> What's done, what's next, what's on the horizon.

Last updated: 2026-02-16

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
- [x] 57 tests, 0 TypeScript errors

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
- [x] Health check endpoint (`GET /__health`)
- [ ] Graceful shutdown (finish in-flight requests, close DB connections)
- [ ] Structured logging (JSON logs with feature name, request ID, duration)
- [ ] Request body size limits

---

## ✅ SSE Streaming (done)

First-class Server-Sent Events support for AI agent and real-time streaming use cases.

- [x] `type: 'stream'` features with `stream()` handler instead of `handle()`
- [x] `emit()` helper — `emit(data)` for unnamed events, `emit(event, data)` for named events
- [x] Both plain text and JSON event data
- [x] Auto-close on function return, explicit `close()` and `fail()` helpers
- [x] Initial `meta` event with feature name and request ID
- [x] Server SSE execution path with graceful error handling and client disconnect support
- [x] `createTestClient.stream()` — collects events into assertable array
- [x] CLI: `manifest check` validates stream features, `manifest make:feature --type=stream` scaffolds them
- [x] `manifest-sse-example` extension with TokenStream demo + frontend consumption guides (vanilla JS, SolidJS, React, Vue)
- [ ] Heartbeat keepalive (configurable interval)
- [ ] Connection timeout (configurable max duration)
- [ ] Client reconnection support (`Last-Event-ID`)

---

## 🔨 Phase 2: Real-Time & Events

### Event-Triggered Features

- [ ] `type: 'event'` features with `trigger: 'event.name'`
- [ ] Internal event bus (in-process, explicit)
- [ ] Features can emit events: `emit('order.shipped', payload)`
- [ ] Event features execute in response — same `handle()` pattern
- [ ] Events are traceable in logs with the originating request ID

---

## ✅ Extensions Ecosystem (done)

Extensions are self-contained packages that add features, schemas, and services.

### Extension Scanner

- [x] Scanner reads `extensions/*/features/` in addition to `features/`
- [ ] Scanner reads `extensions/*/schemas/` and `extensions/*/services/`
- [x] `MANIFEST.md` includes extension features in the index
- [x] `bun manifest check` validates extension features same as app features
- [x] `EXTENSION.md` format specification with YAML frontmatter

### Extension CLI

- [x] `bun manifest extension make <name>` — scaffold a new extension
- [x] `bun manifest extension install <src>` — install from a source
- [x] `bun manifest extension list` — list installed extensions
- [ ] `bun manifest extension remove <name>` — remove an extension directory

### Shipped Extensions

- [x] `manifest-frontend-static` — HTML + Tailwind CSS + vanilla TypeScript
- [x] `manifest-frontend-reactive` — SolidJS + Tailwind CSS + JSX
- [x] `manifest-sse-example` — SSE streaming demo with frontend consumption guides

### First-Party Extensions (planned)

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

### Agent Lifecycle & Guardrails → OpenClaw

Agent memory, guardrails, monitoring, and multi-agent coordination are managed by **OpenClaw** (see Phase 6). Manifest provides the hooks — structured logs, `MANIFEST.md`, `AGENTS.md`, the `/__health` endpoint — and OpenClaw provides the orchestration layer.

---

## 🔨 Phase 6: OpenClaw Integration

OpenClaw manages the production agent lifecycle — deploying, monitoring, and controlling the AI sidecar that runs alongside your Manifest app. Instead of building bespoke agent orchestration into every project, OpenClaw provides it as a managed service.

- [ ] **OpenClaw SDK integration** — Connect Manifest's production agent to OpenClaw for lifecycle management (start, stop, restart, health checks)
- [ ] **Agent provisioning** — OpenClaw deploys and configures the agent sidecar based on the Manifest project's `AGENTS.md` and `MANIFEST.md`
- [ ] **Remote monitoring** — Error events, agent actions, and fix history streamed to OpenClaw dashboard
- [ ] **Guardrail enforcement** — OpenClaw enforces agent boundaries (branch protection, file access, network limits) from outside the container
- [ ] **Agent memory sync** — Agent memory persisted and synced through OpenClaw, survives container restarts and redeployments
- [ ] **Human escalation** — When the agent can't fix something, OpenClaw routes it to the right human with full context (error, attempted fixes, relevant feature files)
- [ ] **Multi-agent coordination** — OpenClaw manages multiple agents across environments (staging, production) and prevents conflicts

This replaces the bespoke "Agent Sidecar" and "Agent Guardrails" sections from Phase 5 — OpenClaw handles that layer so Manifest focuses on the framework.

---

## 🌊 Phase 7: Things We're Thinking About

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
