import { Database } from 'bun:sqlite'
import fs from 'fs'
import path from 'path'
import sparkConfig from '../config/spark'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Event emitted by Spark when something notable happens in the application. */
export type SparkEvent = {
  type: 'server-error' | 'unhandled-error' | 'process-error' | 'rate-limit'
  traceId: string
  timestamp?: string
  environment?: string
  feature?: string
  route?: string
  status?: number
  error?: { message: string; stack?: string }
  request?: { input?: Record<string, unknown> }
  /** Command that was run (process-error events). */
  command?: string
  /** Process exit code (process-error events). */
  exitCode?: number
  /** Path to the full log file (process-error events). */
  logFile?: string
  /** Last ~50 lines of process output (process-error events). */
  tail?: string
}

/** A single HTTP access log entry. */
export type AccessLog = {
  timestamp: string
  method: string
  path: string
  status: number
  duration_ms: number
  ip?: string
  feature?: string
  request_id?: string
  input?: string
  error?: string
  user_agent?: string
}

/** Filters for querying access logs. */
export type AccessLogQuery = {
  feature?: string
  status?: number
  since?: string
  limit?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_DIR = '.spark'
const DB_PATH = path.join(DB_DIR, 'spark.db')
const MAX_DATA_BYTES = 64 * 1024 // 64KB
const MAX_USER_AGENT_BYTES = 1024 // 1KB

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  trace_id    TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  environment TEXT,
  feature     TEXT,
  route       TEXT,
  status      INTEGER,
  data        TEXT NOT NULL,
  consumed    INTEGER DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_poll ON events (consumed, id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);

CREATE TABLE IF NOT EXISTS access_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT NOT NULL,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  status      INTEGER NOT NULL,
  duration_ms REAL NOT NULL,
  ip          TEXT,
  feature     TEXT,
  request_id  TEXT,
  input       TEXT,
  error       TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_feature ON access_logs (feature);
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(value: string | undefined, max: number): string | null {
  if (value == null) return null
  return value.length > max ? value.slice(0, max) : value
}

function openDatabase(): Database {
  fs.mkdirSync(DB_DIR, { recursive: true })

  let db: Database
  try {
    db = new Database(DB_PATH)
  } catch (err) {
    console.error(`[sparkDb] Corrupt database — deleting and recreating: ${err}`)
    try { fs.unlinkSync(DB_PATH) } catch {}
    try { fs.unlinkSync(DB_PATH + '-wal') } catch {}
    try { fs.unlinkSync(DB_PATH + '-shm') } catch {}
    db = new Database(DB_PATH)
  }

  try {
    db.exec('PRAGMA journal_mode=WAL')
    db.exec(SCHEMA_SQL)
  } catch (err) {
    // Schema creation failed — DB may be corrupt
    console.error(`[sparkDb] Database unusable — deleting and recreating: ${err}`)
    try { db.close() } catch {}
    try { fs.unlinkSync(DB_PATH) } catch {}
    try { fs.unlinkSync(DB_PATH + '-wal') } catch {}
    try { fs.unlinkSync(DB_PATH + '-shm') } catch {}
    db = new Database(DB_PATH)
    db.exec('PRAGMA journal_mode=WAL')
    db.exec(SCHEMA_SQL)
  }
  return db
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

let _db: Database | null = null

function getDb(): Database {
  if (!_db) _db = openDatabase()
  return _db
}

// Prepared statements (lazily created)
let _insertEvent: ReturnType<Database['prepare']> | null = null
let _insertAccess: ReturnType<Database['prepare']> | null = null
let _selectUnconsumed: ReturnType<Database['prepare']> | null = null
let _markConsumed: ReturnType<Database['prepare']> | null = null

function insertEventStmt() {
  if (!_insertEvent) {
    _insertEvent = getDb().prepare(
      `INSERT INTO events (type, trace_id, timestamp, environment, feature, route, status, data)
       VALUES ($type, $trace_id, $timestamp, $environment, $feature, $route, $status, $data)`
    )
  }
  return _insertEvent
}

function insertAccessStmt() {
  if (!_insertAccess) {
    _insertAccess = getDb().prepare(
      `INSERT INTO access_logs (timestamp, method, path, status, duration_ms, ip, feature, request_id, input, error, user_agent)
       VALUES ($timestamp, $method, $path, $status, $duration_ms, $ip, $feature, $request_id, $input, $error, $user_agent)`
    )
  }
  return _insertAccess
}

function selectUnconsumedStmt() {
  if (!_selectUnconsumed) {
    _selectUnconsumed = getDb().prepare(
      `SELECT id, data FROM events WHERE consumed = 0 ORDER BY id ASC`
    )
  }
  return _selectUnconsumed
}

function markConsumedStmt() {
  if (!_markConsumed) {
    _markConsumed = getDb().prepare(
      `UPDATE events SET consumed = 1, consumed_at = $consumed_at WHERE id = $id`
    )
  }
  return _markConsumed
}

/**
 * Spark SQLite data layer.
 * Owns the database at `.spark/spark.db` and provides methods for
 * logging events, access logs, polling unconsumed events, and cleanup.
 */
export const sparkDb = {
  /** Raw Database instance for ad-hoc SQL queries. */
  get db(): Database {
    return getDb()
  },

  /** Insert a Spark event. Serializes the full event to the `data` column (capped at 64KB). */
  logEvent(event: SparkEvent): void {
    const enriched: SparkEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      environment: event.environment || sparkConfig.environment,
    }
    const data = truncate(JSON.stringify(enriched), MAX_DATA_BYTES)!
    insertEventStmt().run({
      $type: enriched.type,
      $trace_id: enriched.traceId,
      $timestamp: enriched.timestamp!,
      $environment: enriched.environment ?? null,
      $feature: enriched.feature ?? null,
      $route: enriched.route ?? null,
      $status: enriched.status ?? null,
      $data: data,
    })
  },

  /**
   * Poll unconsumed events atomically.
   * Selects all rows where consumed=0, marks them consumed, and returns parsed events.
   */
  pollEvents(): SparkEvent[] {
    const db = getDb()
    const now = new Date().toISOString()
    const events: SparkEvent[] = []

    db.transaction(() => {
      const rows = selectUnconsumedStmt().all() as { id: number; data: string }[]
      const mark = markConsumedStmt()
      for (const row of rows) {
        mark.run({ $id: row.id, $consumed_at: now })
        try {
          events.push(JSON.parse(row.data))
        } catch {}
      }
    })()

    return events
  },

  /** Query recent events regardless of consumed status. */
  getRecentEvents(limit: number = 50): SparkEvent[] {
    const rows = getDb()
      .prepare(`SELECT data FROM events ORDER BY id DESC LIMIT ?`)
      .all(limit) as { data: string }[]
    const events: SparkEvent[] = []
    for (const row of rows) {
      try { events.push(JSON.parse(row.data)) } catch {}
    }
    return events
  },

  /** Insert an access log entry. Truncates input/error at 64KB and user_agent at 1KB. */
  logAccess(log: AccessLog): void {
    insertAccessStmt().run({
      $timestamp: log.timestamp,
      $method: log.method,
      $path: log.path,
      $status: log.status,
      $duration_ms: log.duration_ms,
      $ip: log.ip ?? null,
      $feature: log.feature ?? null,
      $request_id: log.request_id ?? null,
      $input: truncate(log.input, MAX_DATA_BYTES),
      $error: truncate(log.error, MAX_DATA_BYTES),
      $user_agent: truncate(log.user_agent, MAX_USER_AGENT_BYTES),
    })
  },

  /** Query access logs with optional filters. */
  queryAccess(opts?: AccessLogQuery): AccessLog[] {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}
    const limit = opts?.limit ?? 100

    if (opts?.feature) {
      conditions.push('feature = $feature')
      params.$feature = opts.feature
    }
    if (opts?.status != null) {
      conditions.push('status = $status')
      params.$status = opts.status
    }
    if (opts?.since) {
      conditions.push('timestamp >= $since')
      params.$since = opts.since
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT timestamp, method, path, status, duration_ms, ip, feature, request_id, input, error, user_agent
                 FROM access_logs ${where} ORDER BY id DESC LIMIT $limit`
    params.$limit = limit

    return getDb().prepare(sql).all(params) as AccessLog[]
  },

  /**
   * Clean up old rows based on spark config.
   * Deletes consumed events and access logs older than maxAgeDays.
   * If DB file exceeds maxSizeMB, aggressively prunes and VACUUMs.
   */
  cleanup(): void {
    const db = getDb()
    const maxAgeDays = (sparkConfig as any).db?.cleanup?.maxAgeDays ?? 7
    const maxSizeMB = (sparkConfig as any).db?.cleanup?.maxSizeMB ?? 100

    const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString()
    db.exec(`DELETE FROM events WHERE consumed = 1 AND timestamp < '${cutoff}'`)
    db.exec(`DELETE FROM access_logs WHERE timestamp < '${cutoff}'`)

    // Check file size for aggressive pruning
    try {
      const stats = fs.statSync(DB_PATH)
      const sizeMB = stats.size / (1024 * 1024)
      if (sizeMB > maxSizeMB) {
        const aggressiveEventCutoff = new Date(Date.now() - 3600000).toISOString() // 1h
        const aggressiveAccessCutoff = new Date(Date.now() - 86400000).toISOString() // 24h
        db.exec(`DELETE FROM events WHERE consumed = 1 AND timestamp < '${aggressiveEventCutoff}'`)
        db.exec(`DELETE FROM access_logs WHERE timestamp < '${aggressiveAccessCutoff}'`)
        db.exec('VACUUM')
      }
    } catch {}
  },

  /** Close the database connection. */
  close(): void {
    if (_db) {
      // Clear prepared statement references
      _insertEvent = null
      _insertAccess = null
      _selectUnconsumed = null
      _markConsumed = null
      _db.close()
      _db = null
    }
  },
}
