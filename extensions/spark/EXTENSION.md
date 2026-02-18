---
name: spark
version: 0.1.0
description: "Reactive AI sidekick for Manifest apps. Captures errors and access logs in a SQLite database, polled by a Pi agent extension for real-time investigation and fixes."
author: "Manifest"
services:
  - sparkDb: "SQLite-backed event and access log storage with polling, cleanup, and query support (in services/sparkDb.ts)."
config:
  - SPARK_ENV: "Override environment (defaults to NODE_ENV, then 'development')."
  - enabled: "Master switch for Spark event emission. (default: true)"
  - db.path: "Path to the SQLite database file, relative to project root. (default: .spark/spark.db)"
  - db.pollIntervalMs: "How often the Pi extension polls for new events in ms. (default: 1000)"
  - db.cleanup.maxAgeDays: "Delete consumed events and access logs older than this many days. (default: 7)"
  - db.cleanup.maxSizeMB: "Trigger aggressive pruning and VACUUM when DB file exceeds this size. (default: 100)"
  - db.cleanup.intervalMs: "How often the cleanup job runs in ms. (default: 300000)"
  - watch.unhandledErrors: "Capture uncaughtException/unhandledRejection. (default: true)"
  - watch.serverErrors: "Capture 500 errors from features. (default: true)"
  - environments.development.tools: "Tool access level in dev. (default: full)"
  - environments.development.behavior: "How Pi reacts to errors in dev. (default: fix)"
  - environments.production.tools: "Tool access level in prod. (default: full)"
  - environments.production.behavior: "How Pi reacts to errors in prod. (default: fix)"
---

# Spark

A reactive AI sidekick that watches your Manifest app for errors and injects them into a [Pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) agent session. When your app throws a 500 or an unhandled exception, Spark captures the error with full context — feature name, route, stack trace, trace ID — and stores it in a SQLite database. The Pi extension polls the database and delivers events to Pi so it can investigate and fix the issue automatically.

---

## Getting Started

### 1. Initialize Spark

```bash
bun run manifest spark init
```

This does three things:
- Creates `config/spark.ts` with sensible defaults (if it doesn't exist)
- Adds the Spark Pi extension path to `.pi/settings.json`
- Adds process hooks to `index.ts` for uncaught errors

### 2. Start Spark

Spark runs as a **web sidecar** — a separate Bun process with a browser dashboard. Set `web.enabled: true` and a `SPARK_WEB_TOKEN` in `config/spark.ts`, then:

```bash
# Start the Spark sidecar (watches for errors, browser dashboard on port 8081)
SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts

# Open the dashboard
open http://localhost:8081/
```

The sidecar runs on its own port and **survives main server crashes** — you can still talk to Spark and investigate even when your app is down. See `extensions/spark-web/EXTENSION.md` for full setup.

### 3. Human Pi (Optional)

For interactive coding sessions, Pi ships as a project dependency:

```bash
bunx pi
```

Spark auto-loads via `.pi/settings.json`. You'll need an API key for your preferred LLM provider (Anthropic, OpenAI, etc.) — Pi uses your own subscription. Run `pi` and it will guide you through API key setup on first launch.

**Already have Pi installed globally?** That works too — just run `pi` in the project directory. The local `.pi/settings.json` tells it to load Spark regardless of how Pi was installed.

### 4. Verify it works

1. Start your app: `bun --hot index.ts`
2. Trigger a 500 error (e.g., call a feature that hits a missing database)
3. Check that an event appears in the database:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; console.log(sparkDb.getRecentEvents(5))"
   ```
4. If Pi is running, look for the error context appearing in your Pi session

### 5. Start a fresh session

After running `spark init`, **start a new Pi session** (close and reopen `bunx pi`). This ensures the Spark extension is loaded from the start with full context — system prompt, skills, and project awareness all wired in correctly.

On first startup in a new project, Spark will proactively orient itself: reading `AGENTS.md`, scanning available skills, and building familiarity with the codebase. This takes a moment but means Spark is ready to act on errors with full context — not flying blind.

> **Already in a Pi session when you ran `spark init`?** You can continue, but the Spark extension won't be active until you restart. Start a fresh session to get the full experience.

---

## Web Sidecar

The Spark sidecar is a separate Bun process with a browser dashboard on port 8081. It hosts a Pi agent session with the Spark extension loaded. The event polling, system prompt injection, and error handling all work identically to a terminal Pi session.

**The sidecar survives main server crashes.** Because it runs as its own process, you can still access the dashboard and ask Spark to investigate what happened even if your app goes down.

To start: set `web.enabled: true` and `SPARK_WEB_TOKEN` in `config/spark.ts`, then run `SPARK_WEB_TOKEN=xxx bun extensions/spark-web/services/sparkWeb.ts`. Open `http://localhost:8081/` and log in with your token.

Human Pi sessions (`bunx pi`) and the web sidecar are fully compatible — you can use both simultaneously.

See `extensions/spark-web/EXTENSION.md` for full setup, architecture, and troubleshooting.

---

## How It Works

Spark uses a **SQLite database** at `.spark/spark.db` for event storage. The architecture is simple and reliable — no file watching, no sockets, no message queues.

1. **Your Manifest app** writes events to the `events` table via the `sparkDb` service whenever an error occurs. Every HTTP request is also logged to the `access_logs` table for observability.
2. **The Pi extension** polls the `events` table on an interval (default: 1 second). It selects all unconsumed events, marks them as consumed atomically, and injects them into the Pi session as a batch.
3. **Trace IDs** link events back to requests. Server errors reuse the `request_id` from Manifest's response envelope. Unhandled errors get a fresh `crypto.randomUUID()`.

### Database schema

The database has two tables:

**`events`** — Error events captured by Spark:
- `id` (autoincrement primary key)
- `type`, `trace_id`, `timestamp`, `environment`, `feature`, `route`, `status`
- `data` — full JSON event payload (capped at 64KB)
- `consumed` — 0 or 1, toggled when the Pi extension reads it
- `consumed_at` — timestamp when consumed

**`access_logs`** — Every HTTP request to the server:
- `id` (autoincrement primary key)
- `timestamp`, `method`, `path`, `status`, `duration_ms`
- `ip`, `feature`, `request_id`, `input`, `error`, `user_agent`

### Event format

Events are stored as JSON in the `data` column:

```json
{
  "type": "server-error",
  "traceId": "abc-123-def",
  "timestamp": "2026-02-15T23:50:00.000Z",
  "environment": "development",
  "feature": "create-user",
  "route": "POST /api/users",
  "status": 500,
  "error": {
    "message": "Connection refused",
    "stack": "Error: Connection refused\n    at ..."
  },
  "request": {
    "input": { "email": "test@example.com" }
  }
}
```

Event types:
- **`server-error`** — a feature returned 500 or threw during `handle()`/`stream()`
- **`unhandled-error`** — `uncaughtException` or `unhandledRejection` at the process level
- **`rate-limit`** — a request was rate-limited (429)

---

## Access Logging

Every HTTP request handled by the Manifest server is logged to the `access_logs` table via `sparkDb.logAccess()`. This gives you full observability into your application's traffic.

Each log entry captures:
- **Request details** — method, path, IP, user agent
- **Response** — status code, duration in milliseconds
- **Manifest context** — feature name, request ID (trace ID), input payload
- **Errors** — error message for failed requests

Query access logs programmatically:

```typescript
import { sparkDb } from './services/sparkDb'

// Recent 500 errors
const errors = sparkDb.queryAccess({ status: 500, limit: 20 })

// Requests to a specific feature
const userRequests = sparkDb.queryAccess({ feature: 'create-user' })

// Everything in the last hour
const recent = sparkDb.queryAccess({ since: new Date(Date.now() - 3600000).toISOString() })
```

Access logs are cleaned up automatically by the same cleanup job that manages events — entries older than `db.cleanup.maxAgeDays` are deleted.

---

## Configuration

All configuration lives in `config/spark.ts`:

```typescript
export default {
  enabled: true,
  environment: (Bun.env.SPARK_ENV || Bun.env.NODE_ENV || 'development') as string,

  db: {
    path: '.spark/spark.db',
    pollIntervalMs: 1000,
    cleanup: {
      maxAgeDays: 7,
      maxSizeMB: 100,
      intervalMs: 300_000,
    },
  },

  watch: {
    unhandledErrors: true,
    serverErrors: true,
  },

  environments: {
    development: {
      tools: 'full' as const,
      behavior: 'fix' as const,
    },
    production: {
      tools: 'full' as const,
      behavior: 'fix' as const,
    },
  },

  web: {
    enabled: false,
    port: Number(Bun.env.SPARK_WEB_PORT) || 8081,
    token: Bun.env.SPARK_WEB_TOKEN || '',
    extensions: [] as string[],
  },
}
```

- **`enabled`** — Master switch. When `false`, the Spark service is a no-op and `server.ts` skips event emission entirely.
- **`environment`** — Determines which environment config block applies. Reads `SPARK_ENV` first, then `NODE_ENV`, defaults to `'development'`.
- **`db.path`** — Path to the SQLite database file, relative to project root.
- **`db.pollIntervalMs`** — How often the Pi extension polls for unconsumed events.
- **`db.cleanup.maxAgeDays`** — Consumed events and access logs older than this are deleted.
- **`db.cleanup.maxSizeMB`** — When the DB file exceeds this size, aggressive pruning and VACUUM are triggered.
- **`db.cleanup.intervalMs`** — How often the automatic cleanup job runs.
- **`watch`** — Toggle which error types Spark captures (`unhandledErrors`, `serverErrors`).
- **`environments`** — Per-environment behavior. `tools` controls what Pi can do; `behavior` controls how aggressively it acts.

---

## Environment Modes

### Development (`behavior: 'fix'`, `tools: 'full'`)

Pi has full access to coding tools. When an error arrives, Spark instructs Pi to:
1. Read the error and stack trace
2. Navigate to the relevant feature and source files
3. Investigate the root cause
4. Apply a fix if the cause is clear
5. Report what it found and what it changed

This is the default. Spark actively fixes your app while you work.

### Production (`behavior: 'fix'`, `tools: 'full'`)

Pi has full access to coding tools — same as development. The difference is **mindset, not capability**. When an error arrives in production, Spark:
1. Analyzes the error and stack trace thoroughly
2. Reads the full context — feature file, related services, recent commits
3. Assesses blast radius before touching anything
4. Applies the smallest, most surgical fix possible
5. Reports exactly what it found and what it changed

No refactoring in production — fix the bug, nothing more. If the root cause is ambiguous, Spark explains its analysis and proposed fix before acting.

---

## Troubleshooting

### Events not appearing in the database

1. Verify `config/spark.ts` exists and `enabled` is `true`.
2. Check the database exists:
   ```bash
   ls -la .spark/spark.db
   ```
3. Verify events are being written:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; console.log(sparkDb.getRecentEvents(5))"
   ```
4. Confirm the error type is being watched — check `watch.serverErrors` and `watch.unhandledErrors` in config.
5. Make sure the `sparkDb` service is imported in the code path that should emit the event (e.g., `server.ts` for server errors).

### Database file growing too large

1. Check the current DB size:
   ```bash
   ls -lh .spark/spark.db
   ```
2. Review cleanup config in `config/spark.ts` — `db.cleanup.maxAgeDays` and `db.cleanup.maxSizeMB`.
3. Lower `maxAgeDays` to clean up more aggressively.
4. Run a manual cleanup:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; sparkDb.cleanup(); console.log('done')"
   ```
5. If the DB is still large after cleanup, run VACUUM manually:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; sparkDb.db.exec('VACUUM'); console.log('done')"
   ```

### Pi not reacting to events

1. Verify the Pi extension is registered:
   ```bash
   cat .pi/settings.json
   ```
   Look for `"./extensions/spark/pi-extension"` in the `extensions` array.
2. Confirm Pi is running — run `bunx pi` and look for Spark activity.
3. Check that the polling interval isn't too high — `db.pollIntervalMs` in `config/spark.ts` (default: 1000ms).
4. Verify there are unconsumed events in the database:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; console.log(sparkDb.db.prepare('SELECT count(*) as n FROM events WHERE consumed = 0').get())"
   ```
5. Restart Pi — close and re-run `bunx pi` in the project directory.

### Corrupt database

If you see errors about a corrupt or unusable database, the `sparkDb` service auto-recovers by deleting and recreating the DB file. If it persists:

1. Stop all processes (server, sidecar, Pi).
2. Delete the database files:
   ```bash
   rm -f .spark/spark.db .spark/spark.db-wal .spark/spark.db-shm
   ```
3. Restart your app — the database will be recreated automatically.

### Don't have Pi?

Pi ships as a project dependency — run `bunx pi` from the project directory. If you prefer a global install:
```bash
npm install -g @mariozechner/pi-coding-agent
```
You'll need an API key for your preferred LLM provider (Anthropic, OpenAI, etc.). Run `pi` or `bunx pi` in the project directory — Spark will auto-load if `.pi/settings.json` is configured.
