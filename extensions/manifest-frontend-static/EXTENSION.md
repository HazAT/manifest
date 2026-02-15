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
bun add tailwindcss
```

Tailwind v4 works via CSS `@import` — no config file needed. The `styles.css` template already has the correct import.

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
}
```

### 5. Add dist to .gitignore

```bash
echo 'dist/' >> .gitignore
```

### 6. Verify the build

```bash
bun manifest frontend build
```

You should see output listing built files in `dist/`.

### 7. Start development

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
```

This single import gives you all of Tailwind's utility classes. Bun's bundler processes the CSS import when `tailwindcss` is installed as a dependency.

To customize Tailwind (themes, colors, fonts), use CSS `@theme` in `styles.css`:

```css
@import "tailwindcss";

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
