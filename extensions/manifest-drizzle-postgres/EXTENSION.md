---
name: manifest-drizzle-postgres
version: 0.1.0
description: "Drizzle ORM + Postgres preset. Provides templates and setup instructions for database access."
author: "Manifest"
---

# Drizzle Postgres Extension

Drizzle ORM with the `postgres` driver as an opt-in database layer for Manifest projects. Copy the templates, set a connection string, and you have type-safe Postgres queries inside your features.

Best for: any project that needs a relational database. Drizzle gives you a thin, type-safe query layer with zero runtime overhead.

---

## Install Instructions

Follow every step. Do not skip any.

### 1. Install dependencies at the project root

```bash
bun add drizzle-orm postgres && bun add -D drizzle-kit
```

Dependencies must be installed at the root — not inside the extension directory — so that module resolution works from your features and services.

### 2. Copy the Drizzle config to the project root

```bash
cp extensions/manifest-drizzle-postgres/templates/drizzle.config.ts drizzle.config.ts
```

This tells Drizzle Kit where to find your schemas and where to output migrations.

### 3. Copy the database service

```bash
cp extensions/manifest-drizzle-postgres/templates/db.ts services/db.ts
```

This creates a shared `db` instance that all features import.

### 4. Copy the example schema

```bash
cp extensions/manifest-drizzle-postgres/templates/example.ts schemas/example.ts
```

This gives you a working `posts` table to start with. Rename or replace it with your own tables.

### 5. Set DATABASE_URL

Set the `DATABASE_URL` environment variable before starting the server. The format:

```
postgresql://user:password@localhost:5432/your_database
```

How you set it is up to you — `.env` file, shell export, Docker Compose environment block, etc. The `services/db.ts` template reads `process.env.DATABASE_URL` and throws if it's missing.

### 6. Generate and run the initial migration

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

The first command reads your schemas and generates SQL migration files in `drizzle/`. The second applies them to your database.

---

## Usage

Import `db` from your service and query inside any feature's `handle()` function.

### Select rows

```typescript
import { defineFeature, t } from '../manifest'
import { db } from '../services/db'
import { posts } from '../schemas/example'

export default defineFeature({
  name: 'list-posts',
  description: 'Returns all posts, ordered by creation date.',
  route: ['GET', '/api/posts'],
  authentication: 'none',
  sideEffects: [],
  errorCases: [],

  input: {},

  async handle({ ok }) {
    const allPosts = await db.select().from(posts).orderBy(posts.createdAt)
    return ok('Posts retrieved', { data: { posts: allPosts } })
  },
})
```

### Insert a row

```typescript
import { defineFeature, t } from '../manifest'
import { db } from '../services/db'
import { posts } from '../schemas/example'

export default defineFeature({
  name: 'create-post',
  description: 'Creates a new post.',
  route: ['POST', '/api/posts'],
  authentication: 'required',
  sideEffects: ['Inserts one row into posts table'],
  errorCases: ['422 - Validation failed'],

  input: {
    title: t.string({ description: 'Title of the post.', required: true, maxLength: 255 }),
    body: t.string({ description: 'Full body content.', required: true }),
  },

  async handle({ input, ok }) {
    const [post] = await db.insert(posts).values({
      title: input.title,
      body: input.body,
    }).returning()

    return ok('Post created', { data: { post }, status: 201 })
  },
})
```

### Filter with conditions

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../services/db'
import { posts } from '../schemas/example'

// Inside a handle() function:
const [post] = await db.select().from(posts).where(eq(posts.id, input.id))
if (!post) {
  return fail('Post not found', { status: 404 })
}
```

---

## How to Add a Schema

Create a new file in `schemas/`. One file per table. Every column gets a JSDoc description:

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

/** User accounts. */
export const users = pgTable('users', {
  /** Unique identifier. */
  id: uuid('id').primaryKey().defaultRandom(),
  /** Display name. */
  name: varchar('name', { length: 255 }).notNull(),
  /** Email address, unique across all users. */
  email: varchar('email', { length: 255 }).notNull().unique(),
  /** When the account was created. */
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

After adding or changing a schema, generate and apply a migration:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

---

## Migrations

Drizzle Kit generates SQL migration files from your schema changes. The workflow:

1. **Edit schemas** in `schemas/` — add tables, columns, indexes.
2. **Generate migration:** `bunx drizzle-kit generate` — produces a timestamped SQL file in `drizzle/`.
3. **Review the SQL** — Drizzle Kit generates the diff, but read it before applying. Destructive changes (dropping columns, renaming tables) need care.
4. **Apply migration:** `bunx drizzle-kit migrate` — runs pending migrations against your database.

### Tips

- **Always migrate before starting the app.** If you deploy, run migrations as part of your deploy script, before the server boots.
- **Commit the `drizzle/` directory.** Migration files are source-controlled so every environment runs the same SQL.
- **Be cautious with destructive changes.** Dropping a column deletes data. Renaming a table may break queries. If in doubt, add the new thing first, migrate data, then remove the old thing in a separate migration.
- **For repeatable migration commands**, consider creating a `commands/migrate.ts` that wraps the Drizzle Kit migrate call — useful for CI/CD pipelines or deployment scripts.

---

## Troubleshooting

When the database isn't working, run through these checks in order.

### Connection refused or timeout

1. Check that `DATABASE_URL` is set: `echo $DATABASE_URL`. If empty, set it before starting the server.
2. Check that Postgres is running: `pg_isready -h localhost -p 5432`. If not, start your Postgres instance (Docker, Homebrew service, etc.).
3. Check the connection string format: `postgresql://user:password@host:port/database`. Common mistake: missing the database name at the end.
4. If using Docker, check the container is up: `docker ps | grep postgres`.

### Table does not exist

1. Migrations haven't been applied. Run `bunx drizzle-kit migrate`.
2. Check you're connecting to the right database — the one in `DATABASE_URL` must match where you ran migrations.
3. Run `bunx drizzle-kit generate` first if you've never generated migrations.

### Schema changes not detected by Drizzle Kit

1. Check that `drizzle.config.ts` exists at the project root.
2. Check the `schema` path in `drizzle.config.ts` points to `'./schemas/'`. If you moved your schemas, update the path.
3. Make sure schema files export Drizzle table definitions (using `pgTable`). Plain TypeScript types don't count.

### Import errors (cannot find module)

1. Check that `drizzle-orm` and `postgres` are installed at the project root: `bun pm ls | grep drizzle-orm`.
2. If missing, run `bun add drizzle-orm postgres && bun add -D drizzle-kit`.
3. Don't install inside the extension directory — deps must be at root for module resolution.

### "DATABASE_URL environment variable is not set"

1. This error comes from `services/db.ts` at import time. Set `DATABASE_URL` before starting the server.
2. For local development, export it in your shell: `export DATABASE_URL="postgresql://..."`.
3. For Docker Compose, set it in the `environment` block of your service.

---

## File Structure After Install

```
your-project/
├── drizzle.config.ts           # Drizzle Kit config (schema path, output dir, credentials)
├── schemas/
│   └── example.ts              # Example posts table (rename or replace)
├── services/
│   └── db.ts                   # Shared Drizzle client instance
├── drizzle/                    # Generated migration SQL files (committed to git)
│   └── 0000_*.sql
└── extensions/
    └── manifest-drizzle-postgres/
        ├── EXTENSION.md
        ├── package.json
        └── templates/
            ├── drizzle.config.ts
            ├── db.ts
            └── example.ts
```
