import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import authConfig from "../config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A user row returned from the database. */
export type UserRow = {
	id: string;
	email: string;
	password_hash: string;
	created_at: string;
};

/** A session row returned from the database. */
export type SessionRow = {
	id: string;
	user_id: string;
	expires_at: string;
	created_at: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_PATH = authConfig.db.path;
const DB_DIR = path.dirname(DB_PATH);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
`;

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

function openDatabase(): Database {
	fs.mkdirSync(DB_DIR, { recursive: true });

	let db: Database;
	try {
		db = new Database(DB_PATH);
	} catch (err) {
		console.error(`[authDb] Corrupt database — deleting and recreating: ${err}`);
		try {
			fs.unlinkSync(DB_PATH);
		} catch {}
		try {
			fs.unlinkSync(`${DB_PATH}-wal`);
		} catch {}
		try {
			fs.unlinkSync(`${DB_PATH}-shm`);
		} catch {}
		db = new Database(DB_PATH);
	}

	try {
		db.exec("PRAGMA journal_mode=WAL");
		db.exec(SCHEMA_SQL);
	} catch (err) {
		console.error(`[authDb] Database unusable — deleting and recreating: ${err}`);
		try {
			db.close();
		} catch {}
		try {
			fs.unlinkSync(DB_PATH);
		} catch {}
		try {
			fs.unlinkSync(`${DB_PATH}-wal`);
		} catch {}
		try {
			fs.unlinkSync(`${DB_PATH}-shm`);
		} catch {}
		db = new Database(DB_PATH);
		db.exec("PRAGMA journal_mode=WAL");
		db.exec(SCHEMA_SQL);
	}

	return db;
}

// ---------------------------------------------------------------------------
// Lazy database access
// ---------------------------------------------------------------------------

let _db: Database | null = null;

function getDb(): Database {
	if (!_db) _db = openDatabase();
	return _db;
}

// ---------------------------------------------------------------------------
// Prepared statements (lazily created, nulled on close)
// ---------------------------------------------------------------------------

let _insertUser: ReturnType<Database["prepare"]> | null = null;
let _selectUserByEmail: ReturnType<Database["prepare"]> | null = null;
let _selectUserById: ReturnType<Database["prepare"]> | null = null;
let _insertSession: ReturnType<Database["prepare"]> | null = null;
let _selectSession: ReturnType<Database["prepare"]> | null = null;
let _deleteSession: ReturnType<Database["prepare"]> | null = null;
let _deleteExpiredSessions: ReturnType<Database["prepare"]> | null = null;

function insertUserStmt() {
	if (!_insertUser) {
		_insertUser = getDb().prepare(
			`INSERT INTO users (id, email, password_hash, created_at)
       VALUES ($id, $email, $password_hash, $created_at)`,
		);
	}
	return _insertUser;
}

function selectUserByEmailStmt() {
	if (!_selectUserByEmail) {
		_selectUserByEmail = getDb().prepare(
			`SELECT id, email, password_hash, created_at FROM users WHERE email = $email`,
		);
	}
	return _selectUserByEmail;
}

function selectUserByIdStmt() {
	if (!_selectUserById) {
		_selectUserById = getDb().prepare(
			`SELECT id, email, password_hash, created_at FROM users WHERE id = $id`,
		);
	}
	return _selectUserById;
}

function insertSessionStmt() {
	if (!_insertSession) {
		_insertSession = getDb().prepare(
			`INSERT INTO sessions (id, user_id, expires_at, created_at)
       VALUES ($id, $user_id, $expires_at, $created_at)`,
		);
	}
	return _insertSession;
}

function selectSessionStmt() {
	if (!_selectSession) {
		_selectSession = getDb().prepare(
			`SELECT id, user_id, expires_at, created_at FROM sessions WHERE id = $id`,
		);
	}
	return _selectSession;
}

function deleteSessionStmt() {
	if (!_deleteSession) {
		_deleteSession = getDb().prepare(`DELETE FROM sessions WHERE id = $id`);
	}
	return _deleteSession;
}

function deleteExpiredSessionsStmt() {
	if (!_deleteExpiredSessions) {
		_deleteExpiredSessions = getDb().prepare(`DELETE FROM sessions WHERE expires_at < $now`);
	}
	return _deleteExpiredSessions;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Auth extension SQLite data layer.
 * Owns the database at `data/auth.db` and provides prepared-statement methods
 * for users and sessions. Database is created lazily on first access.
 */
export const authDb = {
	/**
	 * Insert a new user row. Throws if the email is already registered (UNIQUE constraint).
	 */
	createUser(data: { id: string; email: string; passwordHash: string }): void {
		insertUserStmt().run({
			$id: data.id,
			$email: data.email,
			$password_hash: data.passwordHash,
			$created_at: new Date().toISOString(),
		});
	},

	/**
	 * Look up a user by email address.
	 * Returns the user row or null if not found.
	 */
	getUserByEmail(email: string): UserRow | null {
		return (selectUserByEmailStmt().get({ $email: email }) as UserRow | null) ?? null;
	},

	/**
	 * Look up a user by their UUID.
	 * Returns the user row or null if not found.
	 */
	getUserById(id: string): UserRow | null {
		return (selectUserByIdStmt().get({ $id: id }) as UserRow | null) ?? null;
	},

	/**
	 * Insert a new session row.
	 * `expiresAt` should be an ISO 8601 string.
	 */
	createSession(data: { id: string; userId: string; expiresAt: string }): void {
		insertSessionStmt().run({
			$id: data.id,
			$user_id: data.userId,
			$expires_at: data.expiresAt,
			$created_at: new Date().toISOString(),
		});
	},

	/**
	 * Look up a session by its token (id).
	 * Returns the session row or null if not found.
	 * Does NOT check expiry — callers must compare `expires_at` themselves.
	 */
	getSession(token: string): SessionRow | null {
		return (selectSessionStmt().get({ $id: token }) as SessionRow | null) ?? null;
	},

	/**
	 * Delete a session by its token. No-op if the session does not exist.
	 */
	deleteSession(token: string): void {
		deleteSessionStmt().run({ $id: token });
	},

	/**
	 * Delete all sessions whose `expires_at` timestamp is in the past.
	 * Call periodically to keep the sessions table tidy.
	 */
	deleteExpiredSessions(): void {
		deleteExpiredSessionsStmt().run({ $now: new Date().toISOString() });
	},

	/**
	 * Close the database connection and release all prepared statements.
	 * The next call to any method will re-open the database.
	 */
	close(): void {
		if (_db) {
			_insertUser = null;
			_selectUserByEmail = null;
			_selectUserById = null;
			_insertSession = null;
			_selectSession = null;
			_deleteSession = null;
			_deleteExpiredSessions = null;
			_db.close();
			_db = null;
		}
	},
};
