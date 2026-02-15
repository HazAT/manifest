/**
 * Database configuration.
 * Uses Bun.env for environment-specific values with safe defaults.
 */
export default {
  host: Bun.env.DB_HOST ?? 'localhost',
  port: Number(Bun.env.DB_PORT ?? 5432),
  database: Bun.env.DB_NAME ?? 'manifest',
  user: Bun.env.DB_USER ?? 'manifest',
  password: Bun.env.DB_PASSWORD ?? '',
}
