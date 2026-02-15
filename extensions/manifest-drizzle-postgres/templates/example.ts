import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

/** Blog posts written by users. */
export const posts = pgTable('posts', {
  /** Unique identifier for the post. */
  id: uuid('id').primaryKey().defaultRandom(),
  /** Title of the post, displayed in listings and detail views. */
  title: varchar('title', { length: 255 }).notNull(),
  /** Full body content of the post. */
  body: text('body').notNull(),
  /** When the post was created. */
  createdAt: timestamp('created_at').defaultNow().notNull(),
  /** When the post was last updated. */
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
