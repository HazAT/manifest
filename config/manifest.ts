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

  // --- Not yet implemented ---
  // Uncomment when rate limiting is added to the framework:
  // rateLimitDriver: 'memory' as const,
  // rateLimitPrefix: 'manifest:',

  // Uncomment when SSE connection management is added:
  // sseHeartbeatSeconds: 15,
  // sseMaxConnectionSeconds: 300,
}
