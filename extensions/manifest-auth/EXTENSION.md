---
name: manifest-auth
description: Drop-in email/password authentication with HttpOnly cookie sessions for Manifest projects.
version: 0.1.0
author: Manifest
features:
  - auth-register: Register a new user with email and password.
  - auth-login: Login with email and password, sets HttpOnly session cookie.
  - auth-logout: Logout and clear session cookie.
  - auth-me: Get the current authenticated user.
services:
  - auth: Registration, login, logout, session validation, auth resolver factory.
  - authDb: SQLite database layer for users and sessions with prepared statements.
config:
  - db.path: Database file path (default: data/auth.db, override: AUTH_DB_PATH)
  - sessionDurationSeconds: Session lifetime (default: 30 days, override: AUTH_SESSION_DURATION_DAYS)
  - cookie.name: Cookie name (default: auth_session)
  - cookie.secure: HTTPS-only cookies (default: true in production)
  - validation.minPasswordLength: Minimum password length (default: 8)
---

# Manifest Auth

Drop-in email/password authentication for Manifest projects. Uses `Bun.password` (bcrypt) for hashing, `bun:sqlite` for storage, and HttpOnly cookies for sessions. Zero npm dependencies.

## Setup

Wire the auth resolver into your server in `index.ts`:

```typescript
import { auth } from './extensions/manifest-auth/services/auth'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: 3100,
  authenticate: auth.createAuthResolver(),
})
```

That's it. The scanner auto-discovers the four auth features.

## Features

| Feature | Route | Auth | Description |
|---------|-------|------|-------------|
| auth-register | POST /api/auth/register | none | Register with email + password |
| auth-login | POST /api/auth/login | none | Login, creates session, sets cookie |
| auth-logout | POST /api/auth/logout | required | Deletes session, clears cookie |
| auth-me | GET /api/auth/me | required | Returns current user |

## How It Works

1. **Registration** — Email normalized to lowercase, password hashed with `Bun.password.hash()` (bcrypt), stored in SQLite.
2. **Login** — Email lookup, `Bun.password.verify()` check, 64-char hex session token generated via `crypto.getRandomValues`, stored in sessions table, returned as HttpOnly cookie.
3. **Session validation** — The server calls `auth.createAuthResolver()` on every request to features with `authentication: 'required'` or `'optional'`. Reads cookie, looks up session, checks expiry.
4. **Logout** — Session deleted from database, cookie cleared with `Max-Age=0`.

## Using Auth in Your Features

Features with `authentication: 'required'` get the user injected automatically:

```typescript
export default defineFeature({
  authentication: 'required',
  async handle({ user, ok }) {
    // user is guaranteed non-null: { id: string, email: string }
    return ok('Hello', { data: { userId: user!.id } })
  },
})
```

For `authentication: 'optional'`, user may be null.

## Auth Service API

Import the service directly for advanced use cases:

```typescript
import { auth } from './extensions/manifest-auth/services/auth'

// Register
const user = await auth.register('user@example.com', 'password123')

// Login
const { user, sessionToken } = await auth.login('user@example.com', 'password123')

// Validate session
const user = auth.validateSession(token) // AuthUser | null

// Logout
auth.logout(token)
```

## Configuration

Edit `extensions/manifest-auth/config.ts` or use environment variables:

| Config | Env Var | Default |
|--------|---------|---------|
| db.path | AUTH_DB_PATH | data/auth.db |
| sessionDurationSeconds | AUTH_SESSION_DURATION_DAYS | 30 days |
| cookie.name | — | auth_session |
| cookie.secure | — | true in production |
| validation.minPasswordLength | — | 8 |

## Future: OAuth with Arctic

This extension is designed with a clean seam for adding OAuth providers later. When you're ready:

1. Add `provider` and `provider_id` columns to the users table
2. Add OAuth features (e.g., `auth-google.ts`) that use arctic for the OAuth flow
3. Create users with `provider: 'google'` and no `password_hash`
4. The session system works identically — OAuth just creates sessions differently

No changes needed to the auth resolver, session validation, or existing features.

## Troubleshooting

### Auth features not loading
- Check that `extensions/manifest-auth/features/` contains the four `.ts` files
- The scanner auto-discovers them — no manual registration needed
- Run `ls extensions/manifest-auth/features/` to verify

### 401 on all requests
- Verify `index.ts` passes `authenticate: auth.createAuthResolver()` to server
- Check that the cookie name matches config (`auth_session` by default)
- Verify the session hasn't expired (default 30 days)

### Database errors
- Check `data/auth.db` exists and is writable
- Delete `data/auth.db`, `data/auth.db-wal`, `data/auth.db-shm` to reset
- The service auto-recreates the database on corruption

### Cookie not being set
- In dev, `Secure` flag is off — cookies work over HTTP
- In production, `Secure` is on — requires HTTPS
- Check browser dev tools → Application → Cookies

### Password hashing slow
- `Bun.password.hash()` uses bcrypt which is intentionally slow (~100ms)
- This is a security feature, not a bug
