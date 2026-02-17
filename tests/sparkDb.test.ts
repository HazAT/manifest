import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { sparkDb, type SparkEvent, type AccessLog } from '../services/sparkDb'
import fs from 'fs'

const DB_PATH = '.spark/spark.db'

function cleanDb() {
  sparkDb.close()
  try { fs.unlinkSync(DB_PATH) } catch {}
  try { fs.unlinkSync(DB_PATH + '-wal') } catch {}
  try { fs.unlinkSync(DB_PATH + '-shm') } catch {}
}

function makeEvent(overrides: Partial<SparkEvent> = {}): SparkEvent {
  return {
    type: 'server-error',
    traceId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature: 'test-feature',
    ...overrides,
  }
}

function makeAccessLog(overrides: Partial<AccessLog> = {}): AccessLog {
  return {
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: '/api/test',
    status: 200,
    duration_ms: 42,
    ip: '127.0.0.1',
    feature: 'test-feature',
    request_id: crypto.randomUUID(),
    ...overrides,
  }
}

beforeEach(() => cleanDb())
afterEach(() => cleanDb())

describe('sparkDb', () => {
  test('init: creates DB file with tables and WAL mode', () => {
    // Access db to trigger init
    const db = sparkDb.db
    expect(fs.existsSync(DB_PATH)).toBe(true)

    // Check tables exist
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toContain('events')
    expect(names).toContain('access_logs')

    // Check WAL mode
    const mode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    expect(mode.journal_mode).toBe('wal')
  })

  test('logEvent + pollEvents: insert then consume', () => {
    const event = makeEvent()
    sparkDb.logEvent(event)

    const polled = sparkDb.pollEvents()
    expect(polled).toHaveLength(1)
    expect(polled[0].traceId).toBe(event.traceId)
    expect(polled[0].type).toBe('server-error')

    // Second poll returns empty
    expect(sparkDb.pollEvents()).toHaveLength(0)
  })

  test('pollEvents atomicity: consumes all at once', () => {
    sparkDb.logEvent(makeEvent())
    sparkDb.logEvent(makeEvent())
    sparkDb.logEvent(makeEvent())

    const polled = sparkDb.pollEvents()
    expect(polled).toHaveLength(3)
    expect(sparkDb.pollEvents()).toHaveLength(0)
  })

  test('getRecentEvents: returns both consumed and unconsumed', () => {
    sparkDb.logEvent(makeEvent({ traceId: 'a' }))
    sparkDb.logEvent(makeEvent({ traceId: 'b' }))

    // Consume first batch
    sparkDb.pollEvents()

    // Add one more unconsumed
    sparkDb.logEvent(makeEvent({ traceId: 'c' }))

    const recent = sparkDb.getRecentEvents(10)
    expect(recent).toHaveLength(3)
    // Most recent first
    expect(recent[0].traceId).toBe('c')
  })

  test('logAccess + queryAccess: insert and retrieve', () => {
    const log = makeAccessLog()
    sparkDb.logAccess(log)

    const results = sparkDb.queryAccess()
    expect(results).toHaveLength(1)
    expect(results[0].method).toBe('GET')
    expect(results[0].path).toBe('/api/test')
    expect(results[0].status).toBe(200)
    expect(results[0].duration_ms).toBe(42)
    expect(results[0].ip).toBe('127.0.0.1')
    expect(results[0].feature).toBe('test-feature')
    expect(results[0].request_id).toBe(log.request_id)
  })

  test('logAccess truncation: input >64KB is truncated', () => {
    const bigInput = 'x'.repeat(70_000)
    sparkDb.logAccess(makeAccessLog({ input: bigInput }))

    const results = sparkDb.queryAccess()
    expect(results[0].input!.length).toBe(64 * 1024)
  })

  test('queryAccess filters: by feature, status, since, limit', () => {
    const now = new Date()
    const old = new Date(now.getTime() - 3600_000).toISOString()
    const recent = new Date(now.getTime() - 1000).toISOString()

    sparkDb.logAccess(makeAccessLog({ feature: 'auth', status: 200, timestamp: old }))
    sparkDb.logAccess(makeAccessLog({ feature: 'auth', status: 500, timestamp: recent }))
    sparkDb.logAccess(makeAccessLog({ feature: 'users', status: 200, timestamp: recent }))

    // Filter by feature
    expect(sparkDb.queryAccess({ feature: 'auth' })).toHaveLength(2)
    expect(sparkDb.queryAccess({ feature: 'users' })).toHaveLength(1)

    // Filter by status
    expect(sparkDb.queryAccess({ status: 500 })).toHaveLength(1)

    // Filter by since (only recent)
    const sinceTs = new Date(now.getTime() - 2000).toISOString()
    expect(sparkDb.queryAccess({ since: sinceTs })).toHaveLength(2)

    // Limit
    expect(sparkDb.queryAccess({ limit: 1 })).toHaveLength(1)
  })

  test('cleanup: removes old consumed events and access logs', () => {
    const db = sparkDb.db
    const oldTs = new Date(Date.now() - 30 * 86400_000).toISOString() // 30 days ago

    // Insert old consumed event directly
    db.prepare(
      `INSERT INTO events (type, trace_id, timestamp, data, consumed, consumed_at)
       VALUES ('server-error', 'old-trace', $ts, '{}', 1, $ts)`
    ).run({ $ts: oldTs })

    // Insert old access log
    db.prepare(
      `INSERT INTO access_logs (timestamp, method, path, status, duration_ms)
       VALUES ($ts, 'GET', '/old', 200, 10)`
    ).run({ $ts: oldTs })

    // Insert recent data
    sparkDb.logEvent(makeEvent())
    sparkDb.logAccess(makeAccessLog())

    sparkDb.cleanup()

    // Old rows gone, recent rows remain
    const events = db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }
    expect(events.c).toBe(1)

    const logs = db.prepare('SELECT COUNT(*) as c FROM access_logs').get() as { c: number }
    expect(logs.c).toBe(1)
  })

  test('self-healing: recreates DB after corruption', () => {
    // Init the DB first
    sparkDb.logEvent(makeEvent())
    sparkDb.close()

    // Corrupt the file
    fs.writeFileSync(DB_PATH, 'this is not a sqlite database')

    // Access should recover
    const db = sparkDb.db
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as { name: string }[]
    expect(tables.map((t) => t.name)).toContain('events')
  })
})
