# Spark Database Knowledge

You have access to a SQLite database at `.spark/spark.db` that stores application events and HTTP access logs. Use it to answer analytics questions, investigate patterns, and understand application behavior.

## Tables

### events

Stores Spark events — errors, crashes, rate limits, and other notable occurrences.

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,        -- 'server-error' | 'unhandled-error' | 'process-error' | 'rate-limit'
  trace_id    TEXT NOT NULL,        -- Links back to request_id in response envelopes
  timestamp   TEXT NOT NULL,        -- ISO 8601
  environment TEXT,                 -- 'development' | 'production'
  feature     TEXT,                 -- Feature name (e.g. 'create-user')
  route       TEXT,                 -- HTTP route (e.g. 'POST /api/users')
  status      INTEGER,             -- HTTP status code
  data        TEXT NOT NULL,        -- Full event as JSON (up to 64KB)
  consumed    INTEGER DEFAULT 0,   -- 1 = already delivered to an agent
  consumed_at TEXT                  -- When it was consumed
);
```

### access_logs

Every HTTP request to the application is logged here.

```sql
CREATE TABLE access_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT NOT NULL,        -- ISO 8601
  method      TEXT NOT NULL,        -- GET, POST, PUT, DELETE, etc.
  path        TEXT NOT NULL,        -- Request path (e.g. '/api/users')
  status      INTEGER NOT NULL,     -- HTTP status code
  duration_ms REAL NOT NULL,        -- Response time in milliseconds
  ip          TEXT,                 -- Client IP address
  feature     TEXT,                 -- Matched feature name (null for static/unknown routes)
  request_id  TEXT,                 -- Unique request ID (same as trace_id in events)
  input       TEXT,                 -- Request input as JSON (up to 64KB)
  error       TEXT,                 -- Error message if request failed (up to 64KB)
  user_agent  TEXT                  -- Client user agent string (up to 1KB)
);
```

## How to Query

Run queries using bash with `bun:sqlite`:

```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database('.spark/spark.db', { readonly: true }); console.log(JSON.stringify(db.query('SELECT COUNT(*) as count FROM access_logs').all(), null, 2));"
```

## Example Queries

**Visitors in the last hour:**
```sql
SELECT COUNT(DISTINCT ip) as unique_visitors FROM access_logs WHERE timestamp > datetime('now', '-1 hour')
```

**Most used features:**
```sql
SELECT feature, COUNT(*) as hits FROM access_logs WHERE feature IS NOT NULL GROUP BY feature ORDER BY hits DESC
```

**Recent errors:**
```sql
SELECT * FROM events WHERE type = 'server-error' ORDER BY id DESC LIMIT 10
```

**Average response time (last hour):**
```sql
SELECT ROUND(AVG(duration_ms), 2) as avg_ms FROM access_logs WHERE timestamp > datetime('now', '-1 hour')
```

**Slowest endpoints:**
```sql
SELECT feature, ROUND(AVG(duration_ms), 2) as avg_ms, COUNT(*) as hits FROM access_logs WHERE feature IS NOT NULL GROUP BY feature ORDER BY avg_ms DESC
```

**404 count (last 24 hours):**
```sql
SELECT COUNT(*) as count FROM access_logs WHERE status = 404 AND timestamp > datetime('now', '-24 hours')
```

**Traffic over time (by hour):**
```sql
SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour, COUNT(*) as requests FROM access_logs GROUP BY hour ORDER BY hour DESC LIMIT 24
```

**Suspicious IPs (most requests):**
```sql
SELECT ip, COUNT(*) as reqs FROM access_logs GROUP BY ip ORDER BY reqs DESC LIMIT 20
```

**Error rate (percentage of 5xx responses):**
```sql
SELECT ROUND(100.0 * SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_pct FROM access_logs WHERE timestamp > datetime('now', '-1 hour')
```

**Unconsumed events:**
```sql
SELECT id, type, feature, timestamp FROM events WHERE consumed = 0 ORDER BY id ASC
```

## Deep Queries on Event Data

The `data` column in `events` stores the full event as JSON. Use `json_extract()` for deep queries:

```sql
SELECT json_extract(data, '$.error.message') as error_msg, COUNT(*) as occurrences
FROM events WHERE type = 'server-error'
GROUP BY error_msg ORDER BY occurrences DESC
```

```sql
SELECT json_extract(data, '$.request.input') as input FROM events WHERE trace_id = 'some-uuid'
```

## Tips

- **Always use `readonly: true`** when opening the database to avoid accidental writes.
- **Use `LIMIT`** on queries — the table can grow large under traffic.
- **Timestamps are ISO 8601** strings — use SQLite's `datetime()` function for comparisons.
- **The DB uses WAL mode** — reads never block writes and vice versa.
- **`data` is capped at 64KB** per event, `user_agent` at 1KB.
