/**
 * Spark sidekick configuration.
 * Controls the reactive AI sidekick that watches your app for errors
 * and can investigate or fix issues depending on the environment.
 */
export default {
  // Master switch — set to false to disable all Spark behavior
  enabled: true,

  // Current environment — controls tool access and behavior mode
  environment: (Bun.env.SPARK_ENV || Bun.env.NODE_ENV || 'development') as string,

  // Directory where event files are written (relative to project root)
  eventsDir: '.spark/events',

  // Which event types to capture and emit
  watch: {
    unhandledErrors: true,
    serverErrors: true,
    processErrors: true,
  },

  // Per-environment behavior profiles
  environments: {
    development: {
      tools: 'full' as const,     // All coding tools available
      behavior: 'fix' as const,   // Investigate and apply fixes
    },
    production: {
      tools: 'readonly' as const, // Read-only tools only
      behavior: 'alert' as const, // Report issues, don't modify code
    },
  },

  // Pause protocol — stale pause files older than this trigger doctor mode
  pause: {
    staleThresholdMinutes: 30,
  },

  // Event debouncing — batch rapid events within this window
  debounce: {
    windowMs: 1000,
  },
}
