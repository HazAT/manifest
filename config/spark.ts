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
      tools: 'full' as const,     // Full tools — Spark is trusted to act responsibly
      behavior: 'fix' as const,   // Investigate and apply fixes, with extreme care
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

  // Spark Web UI — opt-in browser dashboard for interacting with Spark.
  // Runs as a separate sidecar process that survives main server crashes.
  // Start it explicitly: SPARK_WEB_TOKEN=xxx bun extensions/spark-web/services/sparkWeb.ts
  // Open:  http://localhost:8081/
  web: {
    enabled: false,
    port: Number(Bun.env.SPARK_WEB_PORT) || 8081,
    token: Bun.env.SPARK_WEB_TOKEN || '',
    // Additional Pi extensions to load into the Spark agent session.
    // The Spark core extension is always included automatically.
    // Paths are local TypeScript files resolved relative to the project root:
    //
    //   extensions: [
    //     './extensions/my-custom-tool/index.ts',
    //     './extensions/another-ext/pi-extension/index.ts',
    //   ],
    //
    extensions: [] as string[],
  },
}
