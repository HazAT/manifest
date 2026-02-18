---
name: manifest-frontend-reactive
version: 0.1.0
description: "SolidJS + Tailwind CSS frontend preset. Fine-grained reactivity without a virtual DOM."
author: "Manifest"
---

# Reactive Frontend Extension

SolidJS + Tailwind CSS v4. Fine-grained reactivity without a virtual DOM — only the specific DOM nodes that depend on a signal update, not the whole component tree. Bun bundles it natively (handles the JSX transform).

Best for: interactive apps, dashboards, real-time UIs, anything with client-side state.

---

## Install Instructions

Follow every step. Do not skip any.

### 1. Create the frontend directory

```bash
mkdir -p frontend/public
```

### 2. Copy template files

```bash
cp extensions/manifest-frontend-reactive/templates/index.html frontend/index.html
cp extensions/manifest-frontend-reactive/templates/index.tsx frontend/index.tsx
cp extensions/manifest-frontend-reactive/templates/App.tsx frontend/App.tsx
cp extensions/manifest-frontend-reactive/templates/styles.css frontend/styles.css
```

### 3. Install dependencies

```bash
bun add solid-js tailwindcss @tailwindcss/cli
```

SolidJS is the UI framework. Tailwind v4 works via CSS `@import` — no config file needed.

> **Important:** Bun's bundler does NOT run the Tailwind compiler — it just inlines the CSS import without generating utility classes. You must use the Tailwind CLI as a `postBuild` step (configured in step 5).

### 4. Configure TypeScript for SolidJS

Add these two fields to the `compilerOptions` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

This tells both TypeScript and Bun to use SolidJS's JSX transform instead of React's. Without this, JSX compilation will fail.

### 5. Create the frontend config

Create `config/frontend.ts` with this content:

```typescript
/**
 * Frontend build and serving configuration.
 * Flat, typed, no nesting. Every value is visible and greppable.
 */
export default {
  entryPoint: 'frontend/index.tsx',
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

Note the `.tsx` entry point — this is different from the static extension.

### 6. Add dist to .gitignore

```bash
echo 'dist/' >> .gitignore
```

### 7. Verify the build

```bash
bun run build
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

---

## How SolidJS Works

SolidJS looks like React but works fundamentally differently. Understanding this is essential.

### Components run once

A SolidJS component is a plain function that returns JSX. It runs **once** to set up the reactive graph, then never runs again. Only the specific DOM nodes bound to reactive values update.

```tsx
function Counter() {
  const [count, setCount] = createSignal(0)
  console.log('This logs once, not on every update')
  return <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>
}
```

### createSignal — reactive state

`createSignal()` returns a getter function and a setter function. Call the getter to read, call the setter to write.

```tsx
import { createSignal } from 'solid-js'

const [name, setName] = createSignal('world')
name()            // 'world' — note the () to read
setName('Manifest') // updates any DOM node that called name()
```

### createEffect — side effects

`createEffect()` runs whenever any signal it reads changes. It tracks dependencies automatically.

```tsx
import { createEffect } from 'solid-js'

const [count, setCount] = createSignal(0)

createEffect(() => {
  console.log('Count changed to:', count()) // re-runs when count changes
})
```

### createResource — async data fetching

`createResource()` wraps an async function and gives you reactive loading/error states. This is how you fetch from the API.

```tsx
import { createResource } from 'solid-js'

const fetchUser = async (id: string) => {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

const [user] = createResource(() => 'user-123', fetchUser)

// user()          — the data (or undefined while loading)
// user.loading    — true while the fetch is in progress
// user.error      — the error if the fetch failed
```

### Show — conditional rendering

`<Show>` renders its children only when the `when` prop is truthy. Use `fallback` for the else case.

```tsx
import { Show } from 'solid-js'

<Show when={user()} fallback={<p>Loading...</p>}>
  {(u) => <p>Hello, {u().name}</p>}
</Show>
```

### For — list rendering

`<For>` efficiently renders a list. Each item is tracked individually — adding or removing an item doesn't re-render the others.

```tsx
import { For } from 'solid-js'

<For each={items()}>
  {(item) => <li>{item.name}</li>}
</For>
```

---

## How to Create Components

Create `.tsx` files in `frontend/`. Import and use them in `App.tsx`. No special registration needed.

```tsx
// frontend/UserCard.tsx
export default function UserCard(props: { name: string; email: string }) {
  return (
    <div class="rounded-lg border border-gray-200 p-4">
      <h3 class="font-semibold text-gray-900">{props.name}</h3>
      <p class="text-sm text-gray-600">{props.email}</p>
    </div>
  )
}
```

```tsx
// frontend/App.tsx
import UserCard from './UserCard'

export default function App() {
  return <UserCard name="Alice" email="alice@example.com" />
}
```

Note: SolidJS uses `class` not `className` for CSS classes.

---

## How to Fetch from the API

Use `createResource()` for any API call. It gives you loading and error states for free.

```tsx
import { createResource, Show } from 'solid-js'

async function fetchGreeting() {
  const res = await fetch('/api/hello?name=Manifest')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.data
}

export default function App() {
  const [greeting] = createResource(fetchGreeting)

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <Show when={greeting.error}>
        <p class="text-red-600">Failed to load: {greeting.error?.message}</p>
      </Show>
      <Show when={greeting.loading}>
        <p class="text-gray-500">Loading...</p>
      </Show>
      <Show when={greeting()}>
        {(data) => <h1 class="text-4xl font-bold text-gray-900">{data().message}</h1>}
      </Show>
    </div>
  )
}
```

---

## How to Add Pages

### Single-page app (default)

With `spaFallback: true` in `config/frontend.ts`, all non-API, non-file paths serve `dist/index.html`. Handle routing in SolidJS:

```tsx
import { createSignal } from 'solid-js'
import { Show } from 'solid-js'

function App() {
  const [path] = createSignal(window.location.pathname)

  return (
    <>
      <Show when={path() === '/'}>
        <HomePage />
      </Show>
      <Show when={path() === '/about'}>
        <AboutPage />
      </Show>
    </>
  )
}
```

For more complex routing, install `@solidjs/router`.

---

## How to Add Static Assets

Put files in `frontend/public/`. They get copied to `dist/` as-is during build.

```
frontend/public/
  favicon.ico     → dist/favicon.ico
  images/logo.png → dist/images/logo.png
  fonts/inter.woff2 → dist/fonts/inter.woff2
```

Reference them with absolute paths in JSX:

```tsx
<link rel="icon" href="/favicon.ico" />
<img src="/images/logo.png" alt="Logo" />
```

---

## How Tailwind v4 Works

Tailwind v4 uses CSS-based configuration. No `tailwind.config.ts` needed.

The `styles.css` file contains:

```css
@import "tailwindcss";
@source "../dist";
```

The `@import` declares Tailwind. The `@source "../dist"` tells the Tailwind CLI to scan the built JS bundle in `dist/` for class names — this is essential because your Tailwind classes live in `.tsx` JSX that gets compiled into `dist/`.

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

Use Tailwind classes directly in JSX. Remember: SolidJS uses `class`, not `className`:

```tsx
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

When a frontend error occurs, the browser dev tools trace it back to the original `.tsx` file in `frontend/`, not the bundled output. This is how you debug frontend issues — the source map connects `dist/index.js:142` back to `frontend/App.tsx:28`.

---

## How Dev Reload Works

The template `index.html` includes a dev reload script that connects to `/__dev/reload` via Server-Sent Events. When the server rebuilds files (on change during `bun --hot index.ts`), it sends a reload event through this SSE endpoint and the browser refreshes automatically.

The script only activates on `localhost` — it does nothing in production.

---

## Troubleshooting

When the frontend isn't working, run through these checks in order.

### Build fails with JSX errors

1. Check `tsconfig.json` has both `"jsx": "preserve"` and `"jsxImportSource": "solid-js"` in `compilerOptions`. Without these, Bun doesn't know how to transform JSX and will either fail or silently use React's transform (which breaks SolidJS).
2. Check that `solid-js` is installed: `bun pm ls | grep solid-js`. If missing, run `bun add solid-js`.
3. Make sure frontend files use `.tsx` extension, not `.ts`, for any file containing JSX.

### Build fails or produces no output

1. Run `bun run build` and read the error output.
2. Check that `config/frontend.ts` exists and has `entryPoint: 'frontend/index.tsx'` (note `.tsx`, not `.ts`).
3. Check that `frontend/index.tsx` exists — if the entry point is missing, the build has nothing to bundle.

### Components re-render entirely instead of updating fine-grained

This means SolidJS's reactivity isn't wired up correctly. Common causes:
1. Destructuring props in component arguments — don't do `function Comp({ name })`, do `function Comp(props)` and access `props.name` in JSX. Destructuring breaks reactivity tracking.
2. Calling signals outside of JSX or `createEffect` — `const val = count()` captures a snapshot. Use `count()` directly in JSX or inside reactive contexts.

### Styles missing or Tailwind classes not working

1. **Check `bundleCss: false` is set in `config/frontend.ts`.** Bun's bundler does NOT run the Tailwind compiler — if `bundleCss` is `true` (or unset), Bun outputs a CSS file with Tailwind's base layer but zero utility classes. This is the most common cause of "Tailwind isn't working."
2. **Check `postBuild` is set** to run `bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css --minify`.
3. Check that `@tailwindcss/cli` is installed: `bun pm ls | grep @tailwindcss/cli`. If missing, run `bun add @tailwindcss/cli`.
4. Check that `frontend/styles.css` contains both `@import "tailwindcss";` and `@source "../dist";`. Without `@source`, Tailwind CLI won't scan the built JS for class names.
5. Check that `index.html` has a `<link>` to the built CSS: `<link rel="stylesheet" href="/index.css">`.
6. Run `bun run build` and verify `dist/index.css` contains actual utility classes: `grep 'bg-' dist/index.css`.
7. SolidJS uses `class`, not `className`. If you wrote `className="..."`, it won't apply Tailwind classes.

### Dev reload not working

1. Check that `config/frontend.ts` has `devReload: true`.
2. Open browser dev tools → Network tab → look for a connection to `/__dev/reload`. If it's not there, check that the dev reload script is in `index.html`.
3. The dev reload script only activates on `localhost`. If you're accessing via IP or a different hostname, it won't fire.
4. Check the server is running with `bun --hot index.ts`, not a standalone static file server.

### Static assets in public/ not served

1. Check that files are in `frontend/public/`, not `frontend/` directly.
2. Run `bun run build` and check that files appear in `dist/`.
3. Reference assets with absolute paths (`/images/logo.png`), not relative (`images/logo.png`).

### SPA routing returns 404

1. Check that `config/frontend.ts` has `spaFallback: true`.
2. Make sure the route you're hitting doesn't match an API route or a real file in `dist/` — those take priority over the SPA fallback.

## File Structure After Install

```
your-project/
├── frontend/
│   ├── index.html        # HTML shell with mount point and dev reload
│   ├── index.tsx          # SolidJS render entry point
│   ├── App.tsx            # Root component with API fetch example
│   ├── styles.css         # Tailwind CSS imports
│   └── public/            # Static assets (copied as-is to dist/)
├── config/
│   └── frontend.ts        # Build configuration
├── dist/                  # Built output (gitignored)
│   ├── index.html
│   ├── index.js
│   ├── index.js.map
│   ├── index.css
│   └── index.css.map
└── extensions/
    └── manifest-frontend-reactive/
        ├── EXTENSION.md
        └── templates/
```
