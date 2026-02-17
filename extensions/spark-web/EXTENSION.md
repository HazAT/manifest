---
name: spark-web
version: 0.1.0
description: "Browser dashboard for the Spark AI sidekick. Runs as a sidecar process on its own port, serving a real-time web UI for interacting with Spark."
author: "Manifest"
services:
  - sparkWeb: "Starts a standalone Bun.serve() sidecar with an in-process Pi AgentSession and the Spark extension, bridging WebSocket connections to browsers."
config:
  - web.enabled: "Enable the Spark web dashboard. (default: false)"
  - web.port: "Port for the sidecar server. (default: 8081, env: SPARK_WEB_PORT)"
  - web.token: "Auth token for accessing the dashboard. Required when enabled. (env: SPARK_WEB_TOKEN)"
---

# Spark Web

A browser dashboard for the Spark AI sidekick. This extension runs a **separate sidecar process** on its own port (default 8081) that hosts a Pi agent session with the Spark extension loaded. You get the same Spark experience — error investigation, real-time fixes, conversation history — in a browser tab.

**Key benefit: the sidecar survives main server crashes.** Because it runs as its own process, you can still talk to Spark and investigate what happened even if your app goes down.

**This is opt-in.** Disabled by default. You must explicitly enable it and set an auth token.

---

## How It Works

The sidecar is a standalone process you start separately from your main server:

1. **Starts its own `Bun.serve()`** on a separate port (default 8081), independent of the main app server.
2. **Creates a Pi AgentSession** using the Pi SDK, with the Spark extension loaded. This is the same agent that would run in your terminal — it polls the SQLite database for errors and reacts according to your environment config.
3. **Serves a web dashboard** at `http://localhost:8081/` — a single HTML page with a conversation UI.
4. **Bridges WebSocket connections** between the browser and the agent session. Messages you type go to the agent; responses, tool calls, and Spark events stream back in real time.

Because it runs as its own process, it **survives main server crashes** — you can still access the dashboard and ask Spark to investigate what happened. If the sidecar is already running on that port, starting it again exits silently (idempotent).

---

## Enabling the Dashboard

### 1. Edit `config/spark.ts`

Set `web.enabled` to `true` and provide a token:

```typescript
web: {
  enabled: true,
  port: Number(Bun.env.SPARK_WEB_PORT) || 8081,
  token: Bun.env.SPARK_WEB_TOKEN || 'your-secret-token',
},
```

### 2. Set the token

For local development, a hardcoded token is fine. For production, use the environment variable:

```bash
export SPARK_WEB_TOKEN="a-strong-random-token"
```

**Both `web.enabled: true` AND a non-empty token are required.** If either is missing, the sidecar won't start.

### 3. Start the sidecar

In a separate terminal:

```bash
SPARK_WEB_TOKEN=your-secret-token bun extensions/spark-web/services/sparkWeb.ts
```

The sidecar runs independently from your main server. Start your app in one terminal and the sidecar in another — this way the sidecar survives server crashes and hot reloads.

---

## Accessing the Dashboard

Open your browser to:

```
http://localhost:8081/
```

You'll see a terminal-styled login prompt. Enter your token and hit Enter. On success, a session cookie is set and you're redirected to the dashboard — no need to put the token in the URL.

Once loaded, the dashboard shows:
- **Conversation history** — all messages between you and Spark
- **Streaming responses** — tokens appear as they're generated
- **Tool execution** — see what tools Spark is calling (file reads, edits, bash commands)
- **Spark status** — environment, model, session state
- **Error events** — when your app throws errors, they appear in the conversation as Spark investigates

Type messages in the input box to interact with Spark. It's a full Pi agent — you can ask it questions, have it investigate errors, or request code changes (in development mode).

---

## Loading Additional Extensions

You can load additional Pi extensions into the Spark agent session via the `web.extensions` config array. The Spark core extension (`extensions/spark/pi-extension/index.ts`) is always loaded automatically — you don't need to include it.

Only **local paths** are supported — each entry is a path to a `.ts` file resolved relative to the project root:

| Type | Example | Resolution |
|------|---------|------------|
| Local path | `'./extensions/my-tool/index.ts'` | Resolved relative to project root |

Example configuration in `config/spark.ts`:

```typescript
web: {
  enabled: true,
  port: Number(Bun.env.SPARK_WEB_PORT) || 8081,
  token: Bun.env.SPARK_WEB_TOKEN || '',
  extensions: [
    './extensions/my-custom-tool/index.ts',
  ],
},
```

---

## Architecture

The `sparkWeb` service (`extensions/spark-web/services/sparkWeb.ts`) runs as a **standalone sidecar process**, separate from the main Manifest server. It does three things:

1. **Agent setup** — Imports the Pi SDK, creates an `AgentSession` with `createCodingTools`, loads the Spark extension from `extensions/spark/pi-extension/index.ts`, and subscribes to session events.
2. **HTTP server** — Starts its own `Bun.serve()` on the configured port (default 8081). Serves the dashboard HTML at `/` and handles WebSocket upgrades at `/ws`. Both require token auth.
3. **WebSocket bridge** — Connected browsers receive all agent events (message starts/updates/ends, tool execution, agent lifecycle). Browsers send `prompt` messages to talk to the agent and `abort` messages to cancel streaming.

The sidecar is started explicitly as a separate process. If the port is already in use (e.g., from a previous run), the new instance exits silently — the existing one keeps serving.

The session is in-memory. It persists as long as the sidecar process is running. Restarting the main server has no effect on the sidecar.

---

## Security

- **Cookie-based authentication** — After entering the correct token at the login prompt, the server sets an `HttpOnly`, `SameSite=Strict` session cookie (`spark_session`). The `Secure` flag is added automatically when not on localhost. The token never appears in URLs, browser history, or referrer headers.
- **Rate limiting on login** — The `POST /auth` endpoint is rate-limited to 5 attempts per 60 seconds per IP. Exceeding this returns a 429 with a `Retry-After` header.
- **In-memory sessions** — Session UUIDs are stored in a `Set<string>` in the sidecar process. Restarting the sidecar clears all sessions (users must re-login). There is no session expiry — sessions last until the sidecar restarts.
- **Logout** — `POST /logout` removes the session and clears the cookie.
- **Don't expose to the public internet.** This dashboard gives direct access to a coding agent with full tools in development mode. Bind to localhost or put it behind a VPN/proxy.
- **Use environment variables for the token** in any shared or deployed environment. Don't commit tokens to git.
- **The agent inherits your API keys.** It uses whatever LLM API key is configured in the environment (e.g., `ANTHROPIC_API_KEY`). Treat the dashboard as having the same access as your terminal.

---

## Troubleshooting

### Sidecar not starting

1. Check that the web UI is enabled:
   ```bash
   grep -A 8 'web:' config/spark.ts
   ```
   Verify `enabled: true` and a non-empty `token`.
2. Start the sidecar and check for errors:
   ```bash
   SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts
   ```

### Port already in use (expected)

If you see `⚡ Spark sidecar already running on port 8081`, that's normal — a sidecar from a previous run is still alive. This is by design (crash resilience). The existing sidecar keeps serving.

To restart the sidecar fresh:
```bash
# Find and kill the existing sidecar
lsof -ti:8081 | xargs kill
# Then start it again
SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts
```

### Can't log in (wrong token)

1. Verify the token you're entering matches `config/spark.ts` exactly (check for trailing whitespace).
2. Check the `SPARK_WEB_TOKEN` environment variable the sidecar was started with:
   ```bash
   # Restart with the correct token
   SPARK_WEB_TOKEN=your-token bun extensions/spark-web/services/sparkWeb.ts
   ```

### Rate limited on login (429)

You've exceeded 5 login attempts in 60 seconds. Wait for the `Retry-After` duration shown in the response, then try again. Restarting the sidecar also resets the rate limiter.

### Session expired / redirected to login

The sidecar was restarted, which clears all in-memory sessions. Just log in again with your token.

### Dashboard not loading (404 or blank page)

1. Check you're using the correct URL: `http://localhost:8081/` (port 8081, not the main app port).
2. Verify the HTML file exists:
   ```bash
   ls extensions/spark-web/frontend/index.html
   ```
   If missing, the extension is incomplete — reinstall or recreate it.

### WebSocket not connecting

1. Open browser developer tools → Console tab. Look for WebSocket errors.
2. Verify you're logged in (you should see the dashboard, not the login page). Try logging out and back in.
3. Check that the sidecar is running:
   ```bash
   lsof -i:8081
   ```
4. If behind a reverse proxy, ensure it supports WebSocket upgrades.

### Agent not responding to messages

1. Check that an LLM API key is set:
   ```bash
   echo $ANTHROPIC_API_KEY  # or OPENAI_API_KEY, etc.
   ```
2. Check sidecar output for errors from the Pi SDK or model provider.
3. The dashboard shows `sessionReady` status on connect — if it says the session failed, check the error message.
4. Verify the model is available and your API key has access to it.

### "Failed to create AgentSession" in sidecar output

This means the Pi SDK couldn't initialize. Common causes:
- Missing or incompatible `@mariozechner/pi-coding-agent` dependency — run `bun install`.
- The Spark Pi extension failed to load — check `extensions/spark/pi-extension/index.ts` exists.
- API key issues — the session may fail during model initialization.

Check the full error message in the sidecar's output for specifics.

### Spark events not appearing in conversation

1. Check that Spark itself is enabled:
   ```bash
   bun run manifest spark status
   ```
2. Verify events are being written to the database:
   ```bash
   bun -e "import { sparkDb } from './services/sparkDb'; console.log(sparkDb.getRecentEvents(5))"
   ```
3. Check `config/spark.ts` — ensure `enabled: true` and the relevant `watch` options are on.
4. Trigger a test error and check if an event appears in the database.

### Sidecar keeps running after server stops

This is expected — crash resilience means the sidecar outlives the main server. To stop it:
```bash
lsof -ti:8081 | xargs kill
```

### Blank page (HTML loads but nothing renders)

1. Check browser developer tools → Console for JavaScript errors.
2. Verify `extensions/spark-web/frontend/index.html` is a complete file (not truncated or empty).
3. Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear cached assets.
