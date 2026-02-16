# Manifest Project Instructions

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
