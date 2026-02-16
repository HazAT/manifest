---
name: spark-web
version: 0.1.0
description: "Browser dashboard for the Spark AI sidekick. Embeds a Pi agent session in the Manifest server and serves a real-time web UI for interacting with Spark."
author: "Manifest"
services:
  - sparkWeb: "Creates an in-process Pi AgentSession with the Spark extension, bridges WebSocket connections to browsers."
config:
  - web.enabled: "Enable the Spark web dashboard. (default: false)"
  - web.path: "URL prefix for the dashboard. (default: /_spark)"
  - web.token: "Auth token for accessing the dashboard. Required when enabled. (env: SPARK_WEB_TOKEN)"
---

# Spark Web

A browser dashboard for the Spark AI sidekick. Instead of running Spark in a terminal via `bunx pi`, this extension embeds a Pi agent session directly in your Manifest server and serves a web UI at `/_spark`. You get the same Spark experience — error investigation, real-time fixes, conversation history — in a browser tab.

**This is opt-in.** Disabled by default. You must explicitly enable it and set an auth token.

---

## How It Works

When enabled, the extension:

1. **Creates a Pi AgentSession** in the server process using the Pi SDK, with the Spark extension loaded. This is the same agent that would run in your terminal — it watches `.spark/events/` for errors and reacts according to your environment config.
2. **Serves a web dashboard** at `/_spark` (configurable) — a single HTML page with a conversation UI.
3. **Bridges WebSocket connections** between the browser and the agent session. Messages you type go to the agent; responses, tool calls, and Spark events stream back in real time.

The agent runs in-process. There's no separate Pi process to manage. When your server starts, the agent starts. When it stops, the agent stops.

---

## Enabling the Dashboard

### 1. Edit `config/spark.ts`

Set `web.enabled` to `true` and provide a token:

```typescript
web: {
  enabled: true,
  path: '/_spark',
  token: Bun.env.SPARK_WEB_TOKEN || 'your-secret-token',
},
```

### 2. Set the token

For local development, a hardcoded token is fine. For production, use the environment variable:

```bash
export SPARK_WEB_TOKEN="a-strong-random-token"
```

**Both `web.enabled: true` AND a non-empty token are required.** If either is missing, the web UI won't start.

### 3. Restart the server

```bash
bun --hot index.ts
```

You'll see `[spark-web]` log output if the agent session initializes successfully.

---

## Accessing the Dashboard

Open your browser to:

```
http://localhost:3000/_spark?token=your-secret-token
```

The token is passed as a query parameter. If the token is wrong or missing, you get a 401 response.

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

Three source types are supported:

| Type | Example | Resolution |
|------|---------|------------|
| Local path | `'./extensions/my-tool/index.ts'` | Resolved relative to project root |
| npm package | `'npm:@someone/pi-search-tool@1.0.0'` | Installed and loaded via Pi's SettingsManager |
| Git repo | `'git:github.com/user/pi-extensions@main'` or `'https://github.com/user/pi-tools'` | Cloned and loaded via Pi's SettingsManager |

Example configuration in `config/spark.ts`:

```typescript
web: {
  enabled: true,
  path: '/_spark',
  token: Bun.env.SPARK_WEB_TOKEN || '',
  extensions: [
    './extensions/my-custom-tool/index.ts',
    'npm:@someone/pi-search-tool@1.0.0',
    'https://github.com/user/pi-tools',
  ],
},
```

---

## Architecture

The `sparkWeb` service (`extensions/spark-web/services/sparkWeb.ts`) does three things:

1. **Agent setup** — Imports the Pi SDK, creates an `AgentSession` with `createCodingTools`, loads the Spark extension from `extensions/spark/pi-extension/index.ts`, and subscribes to session events.
2. **HTTP route** — Registers a custom route at `/_spark` that serves the dashboard HTML and handles WebSocket upgrades. Both require token auth.
3. **WebSocket bridge** — Connected browsers receive all agent events (message starts/updates/ends, tool execution, agent lifecycle). Browsers send `prompt` messages to talk to the agent and `abort` messages to cancel streaming.

The session is in-memory. It persists as long as the server is running. Hot reloads (`bun --hot`) will recreate the session — this is expected.

---

## Security

- **Token authentication** — Every HTTP request and WebSocket connection requires the correct token. There's no session cookie or login persistence.
- **Don't expose to the public internet.** This dashboard gives direct access to a coding agent with full tools in development mode. Bind to localhost or put it behind a VPN/proxy.
- **Use environment variables for the token** in any shared or deployed environment. Don't commit tokens to git.
- **The agent inherits your API keys.** It uses whatever LLM API key is configured in the environment (e.g., `ANTHROPIC_API_KEY`). Treat the dashboard as having the same access as your terminal.

---

## Troubleshooting

### Dashboard not loading (404 or blank page)

1. Check that the web UI is enabled:
   ```bash
   grep -A 5 'web:' config/spark.ts
   ```
   Verify `enabled: true` and a non-empty `token`.
2. Check the URL matches the configured path (default: `/_spark`).
3. Verify the HTML file exists:
   ```bash
   ls extensions/spark-web/frontend/index.html
   ```
   If missing, the extension is incomplete — reinstall or recreate it.
4. Check server logs for `[spark-web]` messages at startup.

### WebSocket not connecting

1. Open browser developer tools → Console tab. Look for WebSocket errors.
2. Verify the token in your URL matches `config/spark.ts` exactly (check for trailing whitespace).
3. Check that the server is running and accessible at the expected host/port.
4. If behind a reverse proxy, ensure it supports WebSocket upgrades.

### Agent not responding to messages

1. Check that an LLM API key is set:
   ```bash
   echo $ANTHROPIC_API_KEY  # or OPENAI_API_KEY, etc.
   ```
2. Check server logs for errors from the Pi SDK or model provider.
3. The dashboard shows `sessionReady` status on connect — if it says the session failed, check the error message.
4. Verify the model is available and your API key has access to it.

### "Failed to create AgentSession" in server logs

This means the Pi SDK couldn't initialize. Common causes:
- Missing or incompatible `@mariozechner/pi-coding-agent` dependency — run `bun install`.
- The Spark Pi extension failed to load — check `extensions/spark/pi-extension/index.ts` exists.
- API key issues — the session may fail during model initialization.

Check the full error message in server logs for specifics.

### Spark events not appearing in conversation

1. Check that Spark itself is enabled:
   ```bash
   bun run manifest spark status
   ```
2. Verify `.spark/events/` directory exists and events are being written:
   ```bash
   ls -la .spark/events/
   ```
3. Check `config/spark.ts` — ensure `enabled: true` and the relevant `watch` options are on.
4. Trigger a test error and check if an event file appears in `.spark/events/`.

### Session lost on server restart

This is expected behavior. The agent session is in-memory — when the server restarts (including hot reloads), the session is recreated fresh. Conversation history is not persisted. The agent will re-assess the application state on startup.

### Blank page (HTML loads but nothing renders)

1. Check browser developer tools → Console for JavaScript errors.
2. Verify `extensions/spark-web/frontend/index.html` is a complete file (not truncated or empty).
3. Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear cached assets.
