## Review Summary

**Verdict: NEEDS CHANGES** — 1 P0, 2 P1s, 1 P2.

### Critical findings:

1. **[P0] `input` not in scope in catch block** (`server.ts:217`) — `const input` is declared inside `try`, referenced in `catch`. Every request feature 500 triggers a `ReferenceError`, meaning Spark never emits events for its primary use case. Verified with a repro script.

2. **[P1] Infinite loop risk in error handlers** (`index.ts:17-36`) — `spark.emit()` is async, called without `await` or `.catch()` in `uncaughtException`/`unhandledRejection`. If emit fails, the rejection re-triggers the handler → infinite loop. Fix: add `.catch(() => {})`.

3. **[P1] Duplicate spark.emit() blocks** (`server.ts`) — Same 18-line block copy-pasted twice, already diverged (the P0 proves it). Extract a helper.

4. **[P2] TS strict error** (`pi-extension/index.ts:65`) — `events[0]` needs a `!` assertion.

Tests pass (57/57). The architecture, extension docs, and CLI are all solid — just these two error-handling bugs to fix.