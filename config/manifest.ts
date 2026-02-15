/**
 * Manifest application configuration.
 * Flat, typed, no nesting. Every value is visible and greppable.
 */
export default {
  appName: 'manifest-app',
  appUrl: Bun.env.APP_URL ?? 'http://localhost:8080',
  debug: Bun.env.NODE_ENV !== 'production',

  // API response settings
  includeMetaInResponses: true,
  includeDurationInMeta: true,

  // Rate limiting (not yet implemented)
  rateLimitDriver: 'memory' as const,
  rateLimitPrefix: 'manifest:',

  // Real-time (not yet implemented)
  sseHeartbeatSeconds: 15,
  sseMaxConnectionSeconds: 300,
}
