/**
 * Frontend build and serving configuration.
 * Flat, typed, no nesting. Every value is visible and greppable.
 */
export default {
  entryPoint: 'frontend/index.ts',
  outputDir: 'dist',
  sourceMaps: true,
  spaFallback: true,
  devReload: true,
  // Set to false if your project generates its own HTML (e.g., blog build script)
  copyHtml: true,

  // Set to false when CSS is built by an external tool (e.g., Tailwind CLI
  // with the typography plugin). Prevents Bun's bundler from outputting CSS
  // that overwrites the external tool's output.
  // bundleCss: false,

  // Shell command to run after each frontend build. Runs in both
  // `bun manifest frontend build` and the dev watcher. Use for blog builds,
  // Tailwind CLI, or any post-processing that depends on the JS bundle.
  // postBuild: 'bun run scripts/build-blog.ts && bunx @tailwindcss/cli ...',

  // Additional directories to watch in dev mode. Changes in these directories
  // trigger a full rebuild (Bun.build + postBuild). Paths relative to project root.
  // watchDirs: ['content/'],
}
