---
name: manifest-frontend-static
version: 0.1.0
description: "HTML + Tailwind CSS + vanilla TypeScript frontend preset. No framework, no virtual DOM."
author: "Manifest"
---

# Static Frontend Extension

HTML + Tailwind CSS v4 + vanilla TypeScript. Bun bundles it. No framework, no virtual DOM, no build complexity.

Best for: content sites, blogs, landing pages, dashboards that fetch data from the API.

---

## Install Instructions

Follow every step. Do not skip any.

### 1. Create the frontend directory

```bash
mkdir -p frontend/public
```

### 2. Copy template files

```bash
cp extensions/manifest-frontend-static/templates/index.html frontend/index.html
cp extensions/manifest-frontend-static/templates/index.ts frontend/index.ts
cp extensions/manifest-frontend-static/templates/styles.css frontend/styles.css
```

### 3. Install Tailwind CSS v4

```bash
bun add tailwindcss @tailwindcss/cli
```

Tailwind v4 works via CSS `@import` — no config file needed. The `styles.css` template already has the correct import.

> **Important:** Bun's bundler does NOT run the Tailwind compiler — it just inlines the CSS import without generating utility classes. You must use the Tailwind CLI as a `postBuild` step (configured in step 4).

### 4. Create the frontend config

Create `config/frontend.ts` with this content:

```typescript
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

  // Bun's bundler does not run the Tailwind compiler — it inlines the CSS
  // import but produces no utility classes. Let Tailwind CLI handle CSS.
  bundleCss: false,
  postBuild: 'bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css --minify',
}
```

### 5. (Optional) Disable HTML copying

If your project generates its own HTML files (e.g., a blog build script, static site generator), set `copyHtml: false` in `config/frontend.ts` to prevent the build from copying `frontend/*.html` into `dist/`:

```typescript
copyHtml: false,
```

This is not needed for normal usage — only for projects with custom HTML pipelines.

### 6. Add dist to .gitignore

```bash
echo 'dist/' >> .gitignore
```

### 7. Verify the build

```bash
bun manifest frontend build
```

You should see output listing built files in `dist/`.

### 8. Start development

```bash
bun --hot index.ts
```

---

## How to Run (Development)

One command does everything:

```bash
bun --hot index.ts
```

The server watches `frontend/` for changes, rebuilds automatically, and triggers a browser reload via SSE. No second process needed.

**Optional: standalone watcher.** If you run the server separately (e.g., a different runtime), you can use `bun manifest frontend dev` to run only the file watcher. This is not needed for the normal workflow.

---

## How to Add Pages

### Single-page app (default)

With `spaFallback: true` in `config/frontend.ts`, all non-API, non-file paths serve `dist/index.html`. Handle routing in your TypeScript:

```typescript
const route = window.location.pathname

if (route === '/about') {
  renderAbout()
} else {
  renderHome()
}
```

### Multi-page site

Set `spaFallback: false` in `config/frontend.ts`. Create additional HTML files in `frontend/`:

```
frontend/
  index.html      → dist/index.html     → /
  about.html      → dist/about.html     → /about.html
```

Each HTML file can have its own `<script type="module">` pointing to a different TS entry point. Add additional entry points by creating more `.ts` files and importing them from the HTML.

---

## How to Add Static Assets

Put files in `frontend/public/`. They get copied to `dist/` as-is during build.

```
frontend/public/
  favicon.ico     → dist/favicon.ico
  images/logo.png → dist/images/logo.png
  fonts/inter.woff2 → dist/fonts/inter.woff2
```

Reference them with absolute paths in HTML:

```html
<link rel="icon" href="/favicon.ico">
<img src="/images/logo.png" alt="Logo">
```

---

## How Tailwind v4 Works

Tailwind v4 uses CSS-based configuration. No `tailwind.config.ts` needed.

The `styles.css` file contains:

```css
@import "tailwindcss";
@source "../dist";
```

The `@import` declares Tailwind. The `@source "../dist"` tells the Tailwind CLI to scan the built JS bundle in `dist/` for class names — this is essential because your Tailwind classes live in TypeScript template literals that get compiled into `dist/`.

> **Why Tailwind CLI?** Bun's bundler does NOT run the Tailwind compiler. It inlines the `@import "tailwindcss"` CSS but generates zero utility classes. The Tailwind CLI runs as a `postBuild` step in `config/frontend.ts` to compile the actual utility CSS.

To customize Tailwind (themes, colors, fonts), use CSS `@theme` in `styles.css`:

```css
@import "tailwindcss";
@source "../dist";

@theme {
  --color-brand: #3b82f6;
  --font-family-display: "Inter", sans-serif;
}
```

Add Tailwind classes in your HTML or TypeScript template literals:

```html
<div class="flex items-center gap-4 p-6 bg-white rounded-lg shadow">
  <h1 class="text-2xl font-bold text-gray-900">Hello</h1>
</div>
```

### `@source` directive

Tailwind v4 scans for classes **relative to the CSS file's location** (`frontend/`). Since your TypeScript gets compiled to `dist/`, the `@source "../dist"` directive tells Tailwind CLI to scan there too. The template already includes this.

If you add Tailwind classes in files outside `frontend/` or `dist/`, add more `@source` directives:

```css
@import "tailwindcss";
@source "../dist";
@source "../content";
```

---

## Advanced Configuration

These options in `config/frontend.ts` control how the build pipeline works.

### `bundleCss`

Controls whether Bun's bundler outputs CSS. Defaults to `true`, but **this extension sets it to `false`** because Bun's bundler does not run the Tailwind compiler — it inlines the CSS import but produces no utility classes.

When `bundleCss` is `false`, Bun still bundles your TypeScript — it just skips CSS output entirely, leaving CSS to the Tailwind CLI `postBuild` step.

If you're not using Tailwind and just want plain CSS, set `bundleCss: true` and remove `postBuild`.

### `postBuild`

A shell command that runs after each frontend build. It runs in both `bun manifest frontend build` and the dev watcher, so your post-processing stays in sync during development.

This extension uses it to run Tailwind CLI:

```typescript
postBuild: 'bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css --minify',
```

Other use cases: blog generators, image optimization, any post-processing that needs to run after the bundle.

### `watchDirs`

Additional directories for the dev watcher to monitor. Changes in these directories trigger a full rebuild including `postBuild`. By default, only `frontend/` is watched.

```typescript
export default {
  entryPoint: 'frontend/index.ts',
  outputDir: 'dist',
  watchDirs: ['content/'],
}
```

This is useful when content or templates live outside `frontend/` — for example, a blog with markdown files in `content/`.

### Real-world example

The `manifest-content-blog` extension uses all three options together: `bundleCss: false` to let Tailwind CLI handle CSS with the typography plugin, `postBuild` to run the blog build and Tailwind CLI, and `watchDirs: ['content/']` to rebuild when markdown files change. See that extension's EXTENSION.md for the full setup.

---

## How Source Maps Work

When `sourceMaps: true` in `config/frontend.ts`, built files in `dist/` have `.map` files alongside them:

```
dist/
  index.js
  index.js.map
  index.css
  index.css.map
```

When a frontend error occurs, the browser dev tools (and any error reporting) trace it back to the original file in `frontend/`, not the bundled output. This is how you debug frontend issues — the source map connects `dist/index.js:142` back to `frontend/index.ts:28`.

---

## How Dev Reload Works

The template `index.html` includes a dev reload script that connects to `/__dev/reload` via Server-Sent Events. When `bun manifest frontend dev` rebuilds files, it sends a reload event through this SSE endpoint and the browser refreshes automatically.

The script only activates on `localhost` — it does nothing in production.

---

## Example: Fetching from the API

The template `index.ts` demonstrates fetching from a backend API feature:

```typescript
async function main() {
  const response = await fetch('/api/hello?name=Manifest')
  const data = await response.json()

  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900">${data.message}</h1>
        <p class="mt-2 text-gray-600">Frontend is connected to the API.</p>
      </div>
    </div>
  `
}

main()
```

This assumes you have a `hello` feature at `GET /api/hello`. Replace with your actual API routes.

---

## Troubleshooting

When the frontend isn't working, run through these checks in order.

### Build fails or produces no output

1. Run `bun manifest frontend build` and read the error output.
2. Check that `config/frontend.ts` exists and has `entryPoint: 'frontend/index.ts'`.
3. Check that `frontend/index.ts` exists — if the entry point is missing, the build has nothing to bundle.
4. Check that `tailwindcss` is installed: `bun pm ls | grep tailwindcss`. If missing, run `bun add tailwindcss`.

### Styles missing or Tailwind classes not working

1. **Check `bundleCss: false` is set in `config/frontend.ts`.** Bun's bundler does NOT run the Tailwind compiler — if `bundleCss` is `true` (or unset), Bun outputs a CSS file with Tailwind's base layer but zero utility classes. This is the most common cause of "Tailwind isn't working."
2. **Check `postBuild` is set** to run `bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css --minify`.
3. Check that `@tailwindcss/cli` is installed: `bun pm ls | grep @tailwindcss/cli`. If missing, run `bun add @tailwindcss/cli`.
4. Check that `frontend/styles.css` contains both `@import "tailwindcss";` and `@source "../dist";`. Without `@source`, Tailwind CLI won't scan the built JS for class names.
5. Check that `index.html` has a `<link>` to the built CSS: `<link rel="stylesheet" href="/index.css">`.
6. Run `bun manifest frontend build` and verify `dist/index.css` contains actual utility classes: `grep 'bg-' dist/index.css`.
7. If classes exist in CSS but don't render, hard-refresh the browser (`Cmd+Shift+R`) — the old CSS may be cached.

### Dev reload not working

1. Check that `config/frontend.ts` has `devReload: true`.
2. Open browser dev tools → Network tab → look for a connection to `/__dev/reload`. If it's not there, check that the dev reload script is in `index.html`.
3. The dev reload script only activates on `localhost`. If you're accessing via IP or a different hostname, it won't fire.
4. Check the server is running with `bun --hot index.ts`, not a standalone static file server.

### Static assets in public/ not served

1. Check that files are in `frontend/public/`, not `frontend/` directly.
2. Run `bun manifest frontend build` and check that files appear in `dist/`.
3. Reference assets with absolute paths (`/images/logo.png`), not relative (`images/logo.png`).

### Dev watcher overwrites my CSS

1. **Symptom:** CSS styles disappear or revert after saving a file in `frontend/`.
2. **Cause:** `bundleCss` is not set to `false` in `config/frontend.ts`. Bun's bundler re-outputs `dist/index.css` on each rebuild, overwriting the CSS that Tailwind CLI produced.
3. **Fix:** Set `bundleCss: false` in `config/frontend.ts`. The default config from this extension already does this — if you're seeing this issue, your config may have been overwritten or created manually without it.

### SPA routing returns 404

1. Check that `config/frontend.ts` has `spaFallback: true`.
2. Make sure the route you're hitting doesn't match an API route or a real file in `dist/` — those take priority over the SPA fallback.

## File Structure After Install

```
your-project/
├── frontend/
│   ├── index.html        # HTML shell with mount point and dev reload
│   ├── index.ts          # TypeScript entry point
│   ├── styles.css        # Tailwind CSS imports
│   └── public/           # Static assets (copied as-is to dist/)
├── config/
│   └── frontend.ts       # Build configuration
├── dist/                  # Built output (gitignored)
│   ├── index.html
│   ├── index.js
│   ├── index.js.map
│   ├── index.css
│   └── index.css.map
└── extensions/
    └── manifest-frontend-static/
        ├── EXTENSION.md
        └── templates/
```
