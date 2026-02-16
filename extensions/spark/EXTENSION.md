---
name: spark
version: 0.1.0
description: "Reactive AI sidekick for Manifest apps. Watches for errors and events, emits them to a file-based bus for consumption by a Pi agent."
author: "Manifest"
services:
  - spark: "Event emission, pause/resume control, and status reporting."
config:
  - SPARK_ENV: "Override environment (defaults to NODE_ENV, then 'development')."
  - enabled: "Master switch for Spark event emission. (default: true)"
  - eventsDir: "Directory for event files. (default: .spark/events)"
  - watch.unhandledErrors: "Capture uncaughtException/unhandledRejection. (default: true)"
  - watch.serverErrors: "Capture 500 errors from features. (default: true)"
  - watch.processErrors: "Capture failures from commands run via manifest run. (default: true)"
  - environments.development.tools: "Tool access level in dev. (default: full)"
  - environments.development.behavior: "How Pi reacts to errors in dev. (default: fix)"
  - environments.production.tools: "Tool access level in prod. (default: full)"
  - environments.production.behavior: "How Pi reacts to errors in prod. (default: fix)"
  - pause.staleThresholdMinutes: "Minutes before a pause is considered stale. (default: 30)"
  - debounce.windowMs: "Debounce window for batching events. (default: 1000)"
---

# Spark

A reactive AI sidekick that watches your Manifest app for errors and injects them into a [Pi](https://github.com/nickarbon/pi-coding-agent) agent session. When your app throws a 500 or an unhandled exception, Spark captures the error with full context — feature name, route, stack trace, trace ID — and delivers it to Pi so it can investigate and (in development) fix the issue automatically.

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

### 2. Start Pi

Pi ships as a project dependency of Manifest (`@mariozechner/pi-coding-agent`). No global install needed.

```bash
bunx pi
```

Spark auto-loads via the extension path registered in `.pi/settings.json`.

You'll need an API key for your preferred LLM provider (Anthropic, OpenAI, etc.) — Pi uses your own subscription. Run `pi` and it will guide you through API key setup on first launch.

**Already have Pi installed globally?** That works too — just run `pi` in the project directory. The local `.pi/settings.json` tells it to load Spark regardless of how Pi was installed.

### 3. Verify it works

1. Start your app: `bun --hot index.ts`
2. Trigger a 500 error (e.g., call a feature that hits a missing database)
3. Check that an event file appears in `.spark/events/`
4. If Pi is running, look for the error context appearing in your Pi session

---

## Web UI Mode (Alternative)

Spark can also run as a **sidecar process** with a browser-based dashboard, instead of (or alongside) the standalone terminal. When the web UI is enabled, the main server auto-spawns a separate sidecar process on its own port (default 8081) that hosts a Pi agent session with the Spark extension loaded. The event watching, system prompt injection, and error handling all work identically.

**The sidecar survives main server crashes.** Because it runs as its own process, you can still access the dashboard and ask Spark to investigate what happened even if your app goes down.

To enable: set `web.enabled: true` and `SPARK_WEB_TOKEN` in `config/spark.ts`, then restart the server. Open `http://localhost:8081/?token=your-token` to interact with Spark in the browser.

The standalone `bunx pi` mode and web UI mode are fully compatible — you can use either, or both simultaneously.

See `extensions/spark-web/EXTENSION.md` for full setup, architecture, and troubleshooting.

---

## How It Works

Spark uses a **file-based event bus**. The architecture is deliberately simple — no sockets, no message queues, no dependencies.

1. **Your Manifest app** writes a JSON event file to `.spark/events/` whenever an error occurs. Writes are atomic (write to `.tmp`, then rename) to prevent partial reads.
2. **The Pi extension** watches `.spark/events/` using `fs.watch()`. When new files appear, it waits for a 1-second debounce window, then reads all pending events, batches them into a single message, and injects it into the Pi session.
3. **Trace IDs** link events back to requests. Server errors reuse the `request_id` from Manifest's response envelope. Unhandled errors get a fresh `crypto.randomUUID()`.

### Event format

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
- **`process-error`** — a command run via `bun manifest run` exited with a non-zero code

### Process error events

When a command wrapped by `bun manifest run` fails, Spark emits a `process-error` event:

```json
{
  "type": "process-error",
  "traceId": "abc-123-def",
  "timestamp": "2026-02-16T01:22:30.000Z",
  "environment": "development",
  "command": "bun test",
  "exitCode": 1,
  "logFile": ".spark/logs/bun-test-2026-02-16-012230.log",
  "tail": "... last ~50 lines of output ...",
  "error": {
    "message": "Process 'bun test' exited with code 1"
  }
}
```

The `logFile` field points to the full process output log in `.spark/logs/`. The `tail` field includes the last ~50 lines for immediate context.

### Process logs

All commands run via `bun manifest run` write output to `.spark/logs/` with human-readable filenames:

```
.spark/logs/bun-test-2026-02-16-012230.log
.spark/logs/dev-2026-02-16-012227.log
```

These logs persist regardless of whether Spark events are emitted (they're written for all runs, not just failures). Use `bun manifest doctor` to see recent logs.

---

## Configuration

All configuration lives in `config/spark.ts`:

```typescript
export default {
  enabled: true,
  environment: (Bun.env.SPARK_ENV || Bun.env.NODE_ENV || 'development') as string,
  eventsDir: '.spark/events',

  watch: {
    unhandledErrors: true,
    serverErrors: true,
  },

  environments: {
    development: {
      tools: 'full' as const,     // Pi gets full coding tools
      behavior: 'fix' as const,   // Actively investigates and fixes errors
    },
    production: {
      tools: 'full' as const,     // Full tools — trusted to act responsibly
      behavior: 'fix' as const,   // Investigates and fixes, with extreme care
    },
  },

  pause: {
    staleThresholdMinutes: 30,
  },

  debounce: {
    windowMs: 1000,
  },
}
```

- **`enabled`** — Master switch. When `false`, the Spark service is a no-op and `server.ts` skips event emission entirely (lazy import, zero cost).
- **`environment`** — Determines which environment config block applies. Reads `SPARK_ENV` first, then `NODE_ENV`, defaults to `'development'`.
- **`eventsDir`** — Where event files are written. Relative to project root.
- **`watch`** — Toggle which error types Spark captures.
- **`environments`** — Per-environment behavior. `tools` controls what Pi can do; `behavior` controls how aggressively it acts.
- **`pause.staleThresholdMinutes`** — If a pause file is older than this, it's considered stale and cleared on next Pi startup.
- **`debounce.windowMs`** — After the first new event file is detected, Spark waits this long before batching and delivering all pending events.

---

## Pause/Resume Protocol

Any agent (or human) can tell Spark to back off by creating a pause file:

```bash
bun run manifest spark pause "Deploying new migration, hold off"
```

This writes `.spark/pause` with:
```json
{
  "by": "cli",
  "since": "2026-02-15T23:55:00.000Z",
  "reason": "Deploying new migration, hold off"
}
```

While paused, the Pi extension **buffers events** instead of injecting them. On resume:

```bash
bun run manifest spark resume
```

The pause file is deleted, and Pi reviews any buffered events — acting on those still relevant and discarding stale ones.

**Check current state:**
```bash
bun run manifest spark status
```

Shows: enabled/disabled, current environment, pause state (with age), and pending event count.

**Stale pause detection:** If a pause file is older than `pause.staleThresholdMinutes` (default: 30 minutes), the Pi extension clears it on startup and runs a health assessment — checking for buffered events and reporting findings.

**Coordinating with other agents:** The pause file is a shared signal. If another tool or agent is actively working on the codebase (e.g., a CI pipeline or another Pi session), it can write the pause file to prevent Spark from interfering. The `by` field identifies who paused, and `reason` explains why.

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

Spark is trusted with production access because it works with responsible engineers. It honors that trust by being deliberate, cautious, and transparent. No refactoring in production — fix the bug, nothing more. If the root cause is ambiguous, Spark explains its analysis and proposed fix before acting.

---

## Troubleshooting

### Events not appearing in `.spark/events/`

1. Check that Spark is enabled:
   ```bash
   bun run manifest spark status
   ```
2. Verify `config/spark.ts` exists and `enabled` is `true`.
3. Check the `.spark/events/` directory exists:
   ```bash
   ls -la .spark/events/
   ```
   If missing, create it: `mkdir -p .spark/events`
4. Confirm the error type is being watched — check `watch.serverErrors` and `watch.unhandledErrors` in config.

### Pi not reacting to events

1. Verify the Pi extension is registered:
   ```bash
   cat .pi/settings.json
   ```
   Look for `"./extensions/spark/pi-extension"` in the `extensions` array.
2. Confirm Pi is running — run `pi` and look for "⚡ Spark" in the status area.
3. If Pi is running but not picking up events, check that `.spark/events/` is the correct path relative to the project root.

### Stale pause blocking events

1. Check pause status:
   ```bash
   bun run manifest spark status
   ```
2. If paused and you don't know why:
   ```bash
   cat .spark/pause
   ```
3. Clear it:
   ```bash
   bun run manifest spark resume
   ```

### Event files piling up and never consumed

This means the Pi extension isn't running or has crashed.
1. Check if Pi is running at all.
2. Check `.pi/settings.json` has the extension path.
3. Restart Pi: close and re-run `pi` in the project directory.
4. If events are very old (>5 min), the Pi extension cleans them on startup.

### Process runner not emitting events

1. Check that `watch.processErrors` is `true` in `config/spark.ts`.
2. Verify you're using `bun manifest run <command>`, not running the command directly.
3. Check that the process actually exited non-zero:
   ```bash
   bun manifest run <command>; echo "exit: $?"
   ```
4. If intentionally killed with Ctrl+C, no event is emitted (by design).
5. Check `.spark/logs/` for the log file — if it exists, the runner ran but Spark emission may have failed silently.

### Process logs not appearing

1. Verify `.spark/logs/` directory exists:
   ```bash
   ls -la .spark/logs/
   ```
   The runner creates it automatically, but check permissions.
2. Run `bun manifest doctor` — it shows recent log files in the last hour.

### Don't have Pi?

Pi ships as a project dependency — run `bunx pi` from the project directory. If you prefer a global install:
```bash
npm install -g @mariozechner/pi-coding-agent
```
You'll need an API key for your preferred LLM provider (Anthropic, OpenAI, etc.). Run `pi` or `bunx pi` in the project directory — Spark will auto-load if `.pi/settings.json` is configured.
