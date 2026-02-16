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

  // Bun's bundler does NOT run the Tailwind compiler — it inlines the CSS
  // import but generates zero utility classes. Let Tailwind CLI handle CSS.
  bundleCss: false,
  postBuild: 'bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css --minify',

  // Additional directories to watch in dev mode. Changes in these directories
  // trigger a full rebuild (Bun.build + postBuild). Paths relative to project root.
  // watchDirs: ['content/'],
}
