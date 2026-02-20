import path from 'path'

/**
 * Auth extension configuration.
 * Controls database path, session duration, and cookie settings.
 */
export default {
  db: {
    /** Database file path. Defaults to data/auth.db relative to the project root. */
    path: Bun.env.AUTH_DB_PATH
      ? path.resolve(Bun.env.AUTH_DB_PATH)
      : path.resolve(import.meta.dir, '../../data/auth.db'),
  },

  /** Session duration in seconds. Default: 30 days. Override with AUTH_SESSION_DURATION_DAYS. */
  sessionDurationSeconds: Number(Bun.env.AUTH_SESSION_DURATION_DAYS ?? 30) * 24 * 60 * 60,

  cookie: {
    name: 'auth_session',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: Bun.env.NODE_ENV === 'production',
    path: '/',
  },

  validation: {
    minPasswordLength: 8,
  },
}
