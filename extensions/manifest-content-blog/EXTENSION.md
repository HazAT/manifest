---
name: manifest-content-blog
version: 0.1.0
description: "Markdown blog with static HTML output. Posts in content/posts/, built with marked + Tailwind Typography."
author: "Manifest"
requires:
  - manifest-frontend-static
services:
  - posts: "Loads and parses markdown posts from a directory. Returns sorted Post[] with rendered HTML and read times."
  - rss: "Generates an RSS 2.0 XML feed from a list of posts."
  - frontmatter: "Parses YAML-style frontmatter from a markdown string."
---

# Content Blog Extension

Markdown files in `content/posts/` → static HTML blog. Parses YAML frontmatter, converts to HTML via `marked`, generates index + post pages + RSS feed. The extension provides reusable **services** for post loading, RSS generation, and frontmatter parsing — your build script imports these and adds its own templates.

Best for: personal blogs, dev blogs, project blogs — any site where content lives in markdown.

---

## Services

The extension ships three services that your build script imports. These handle the parsing and data plumbing so your build script only needs to define templates and orchestration.

### `posts` — Post loading and parsing

```typescript
import { loadPosts, type Post } from "../extensions/manifest-content-blog/services/posts"

const posts = loadPosts({ postsDir: "content/posts" })
```

Reads every `.md` file in the given directory, parses frontmatter, converts markdown to HTML via `marked`, calculates read time (230 words/min), filters out drafts, and returns posts sorted newest-first. Warns on files missing required frontmatter fields (`title`, `slug`, `pubDatetime`).

### `rss` — RSS feed generation

```typescript
import { generateRss } from "../extensions/manifest-content-blog/services/rss"

const xml = generateRss({
  posts,
  siteTitle: "My Blog",
  siteDescription: "A blog about things.",
  siteUrl: "https://example.com",
})
```

Returns a complete RSS 2.0 XML string. You write it to disk yourself (e.g. `writeFileSync("dist/rss.xml", xml)`).

### `frontmatter` — YAML frontmatter parser

```typescript
import { parseFrontmatter } from "../extensions/manifest-content-blog/services/frontmatter"

const { data, content } = parseFrontmatter(rawMarkdown)
```

Low-level utility. Splits a markdown string into a `data` record (key-value pairs from the YAML block) and the remaining `content`. Used internally by `loadPosts` — import directly if you need custom frontmatter handling.

---

## Install Instructions

Follow every step. Do not skip any.

**Prerequisite:** Install the `manifest-frontend-static` extension first. This extension builds on top of it.

### 1. Create the content directory

```bash
mkdir -p content/posts
```

### 2. Copy the example post

```bash
cp extensions/manifest-content-blog/content/posts/hello-world.md content/posts/
```

### 3. Copy the build script template

```bash
mkdir -p scripts
cp extensions/manifest-content-blog/templates/build-blog.ts scripts/build-blog.ts
```

This is your file now. It imports `loadPosts` and `generateRss` from the extension's services — those handle all the markdown parsing and RSS generation. The template functions (layout, index page, post page) are inline in the script and yours to customize freely. Edit the `SiteConfig` at the top to set your blog's title, description, URL, and author.

### 4. Copy the styles template

```bash
cp extensions/manifest-content-blog/templates/styles.css frontend/styles.css
```

This template includes `@source "../dist"` — a Tailwind v4 directive that tells the CLI to scan the `dist/` directory for utility classes. Without it, Tailwind only scans relative to the CSS file (`frontend/`) and **will not find any classes** in the generated HTML, producing an empty or near-empty CSS output.

### 5. Install dependencies

```bash
bun add marked
bun add -d @tailwindcss/cli @tailwindcss/typography
```

- `marked` — markdown to HTML conversion (used by the extension's posts service)
- `@tailwindcss/cli` — standalone Tailwind CLI (runs after blog build to scan generated HTML)
- `@tailwindcss/typography` — the `prose` class for styled article content

### 6. Configure the build pipeline

Replace the contents of `config/frontend.ts` with:

```typescript
export default {
  entryPoint: 'frontend/index.ts',
  outputDir: 'dist',
  sourceMaps: true,
  spaFallback: false,
  devReload: true,
  copyHtml: false,
  bundleCss: false,
  postBuild: 'bun run scripts/build-blog.ts && bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css -p @tailwindcss/typography',
  watchDirs: ['content/'],
}
```

Blog-specific options explained:

- **`spaFallback: false`** — the blog is a multi-page site, not a single-page app.
- **`copyHtml: false`** — the blog build script generates all HTML files. Without this, the frontend build copies `frontend/*.html` into `dist/` and overwrites them.
- **`bundleCss: false`** — Tailwind CLI generates the CSS, not Bun's bundler. Without this, the dev watcher's CSS bundling step overwrites Tailwind CLI's output, breaking all styling.
- **`postBuild`** — runs after every frontend build (including during dev). First builds the blog HTML from markdown, then runs Tailwind CLI to generate CSS from the built HTML. This replaces the manual three-step build pipeline.
- **`watchDirs: ['content/']`** — watches the content directory so that editing or adding blog posts triggers a rebuild automatically during dev mode.

### 7. Set up build scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "build": "bun manifest frontend build",
    "dev": "bun --hot index.ts"
  }
}
```

That's it — the `postBuild` config from step 6 handles the blog build and Tailwind CSS automatically. Every time `bun manifest frontend build` runs, it bundles the JS, then executes `postBuild` which builds the blog HTML and generates the CSS. No manual multi-step pipeline needed.

### 8. Build and verify

```bash
bun run build
```

You should see:
- `dist/index.html` — the post listing
- `dist/posts/hello-world/index.html` — the example post
- `dist/rss.xml` — the RSS feed
- `dist/index.css` — Tailwind CSS with typography styles

### 9. Start development

```bash
bun run dev
```

Visit `http://localhost:3000` to see your blog.

---

## Frontmatter Format

Every post needs a YAML frontmatter block at the top:

```yaml
---
title: "Your Post Title"
slug: your-post-slug
description: "A short description for the post listing."
pubDatetime: 2026-01-15T10:00:00Z
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title, displayed as the `<h1>` |
| `slug` | Yes | URL slug — the post lives at `/posts/{slug}/` |
| `description` | No | Shown on the index page under the title |
| `pubDatetime` | Yes | ISO 8601 date, used for sorting (newest first) |
| `draft` | No | Set to `true` to exclude from build |

---

## Adding and Editing Posts

Create a new `.md` file in `content/posts/`:

```bash
cat > content/posts/my-new-post.md << 'EOF'
---
title: "My New Post"
slug: my-new-post
description: "What this post is about."
pubDatetime: 2026-02-01T12:00:00Z
---

Your markdown content here.
EOF
```

Then rebuild:

```bash
bun run build
```

---

## How the Build Pipeline Works

The build script imports **services** from the extension and combines them with your own templates:

```
bun manifest frontend build
       │
       ▼
  1. Bun.build (JS only, bundleCss: false)
       │
       ▼
  2. postBuild runs automatically:
       │
       ├─→ build-blog.ts
       │     ├─ loadPosts() — extension service reads & parses markdown
       │     ├─ your templates — render HTML pages from posts
       │     └─ generateRss() — extension service creates RSS XML
       │
       └─→ Tailwind CLI (scans dist/*.html → dist/index.css)
```

1. **JS bundle** — Bun bundles your TypeScript entry point into `dist/`. CSS is skipped (`bundleCss: false`) because Tailwind CLI handles it.

2. **Blog build** (via `postBuild`) — your build script calls `loadPosts()` to read and parse all markdown files, passes posts through your template functions to generate HTML, and calls `generateRss()` to produce the RSS feed. The extension services handle parsing and data; your script handles layout and design.

3. **Tailwind CLI** (via `postBuild`) — scans all files in `dist/` for Tailwind utility classes and generates the final CSS. The `@tailwindcss/typography` plugin provides the `prose` class used for article body styling.

---

## How Dev Mode Works

```bash
bun --hot index.ts
```

This starts the Manifest server, which:

1. **Runs the full build pipeline** on startup (JS bundle → blog HTML → Tailwind CSS via `postBuild`).
2. **Watches `frontend/` and `content/`** for changes. The `content/` directory is watched because of the `watchDirs: ['content/']` config.
3. **Rebuilds on any change** — editing a blog post, changing a TypeScript file, or updating styles all trigger the same pipeline.
4. **Live reloads the browser** automatically after each rebuild (`devReload: true`).

The `/__health` endpoint at `http://localhost:PORT/__health` returns `200` when the server is ready — useful for scripts or agents that need to wait for startup.

---

## Customizing the Build Script

The build script at `scripts/build-blog.ts` is yours to edit. The architecture separates concerns:

- **Extension services** (`loadPosts`, `generateRss`, `parseFrontmatter`) handle markdown parsing, post loading, and RSS generation. You generally don't need to modify these.
- **Templates** (inline in your build script) define the HTML layout and design. This is what you customize.
- **Orchestration** (bottom of your build script) ties it together — load posts, render pages, write files.

Common customizations:

**Site metadata** — Edit the `SiteConfig` object at the top:

```typescript
const SiteConfig = {
  title: "My Blog",
  description: "Thoughts, tutorials, and notes.",
  url: "https://example.com",
  author: "Your Name",
}
```

**Page templates** — The `layout()`, `indexPage()`, and `postPage()` functions contain the HTML. Edit them directly — there's no template engine to learn. Add dark mode, navigation, social links, about pages — whatever your blog needs.

**Additional pages** — Add new functions following the same pattern (generate HTML, call `writePage()`). The extension services give you the parsed posts; what you render is up to you.

---

## Importing from Astro

Astro blog posts are markdown files with YAML frontmatter — the same format this extension uses. Migration is straightforward:

### 1. Copy your posts

```bash
cp your-astro-project/src/content/blog/*.md content/posts/
```

### 2. Check frontmatter compatibility

This extension expects `title`, `slug`, `description`, and `pubDatetime`. Astro's content collections commonly use the same fields. If your Astro posts use different field names:

| Astro field | Blog extension field | Action |
|-------------|---------------------|--------|
| `title` | `title` | No change needed |
| `slug` | `slug` | No change needed |
| `description` | `description` | No change needed |
| `pubDatetime` | `pubDatetime` | No change needed |
| `date` | `pubDatetime` | Rename to `pubDatetime` |
| `publishDate` | `pubDatetime` | Rename to `pubDatetime` |
| `tags` | — | Ignored (add tag support to build script if needed) |
| `heroImage` | — | Ignored (add hero image support to build script if needed) |

### 3. Copy images

If your Astro posts reference images, copy them to `frontend/public/` and update the paths in your markdown:

```bash
cp -r your-astro-project/public/images frontend/public/
```

### 4. Build and check

```bash
bun run build
```

Open each post in the browser to verify formatting looks correct.

---

## Importing from Hugo / Jekyll

Hugo and Jekyll also use YAML frontmatter, but the field names differ:

**Hugo** — typically uses `title`, `date`, `description`, `slug`. Rename `date` to `pubDatetime`. Hugo's `draft: true` works as-is.

**Jekyll** — uses `title`, `date`, `layout`, `categories`, `tags`. Rename `date` to `pubDatetime`, add a `slug` field (Jekyll derives it from the filename), and remove `layout`. Jekyll filenames often start with a date (`2026-01-15-my-post.md`) — the extension doesn't use filename dates, so you can rename them or leave them.

---

## Troubleshooting

When something isn't working, run through these checks in order.

### Posts not appearing

1. Check that files are in `content/posts/` and end with `.md`.
2. Check that each post has the required frontmatter fields: `title`, `slug`, `pubDatetime`.
3. Check that `draft` is not set to `true`.
4. Run `bun run scripts/build-blog.ts` directly and look for warning messages about skipped files.

### Build fails — "Cannot find module marked"

Install the dependency:

```bash
bun add marked
```

### Build order issues — HTML missing or CSS empty

With `postBuild` configured (step 6), build order is handled automatically — `bun manifest frontend build` runs the JS bundle first, then the blog build, then Tailwind CLI in sequence.

If CSS is empty or missing `prose` styles, first check the `@source` directive (see below), then run `bun run build` to trigger the full pipeline.

### Tailwind classes not applied — site unstyled or layout broken

This is the most common issue. Two things must be true:

1. **`bundleCss: false`** must be set in `config/frontend.ts`. Without it, Bun's CSS bundler runs alongside Tailwind CLI and overwrites its output.
2. The `@source` directive must point to `dist/`.

Tailwind v4 scans for utility classes **relative to the CSS file's location**. Since `styles.css` is in `frontend/`, Tailwind only scans `frontend/` by default — but the generated HTML lives in `dist/`.

1. Open `frontend/styles.css` and check for `@source "../dist";` near the top (after `@import "tailwindcss"`).
2. If it's missing, add it:
   ```css
   @import "tailwindcss";
   @source "../dist";
   ```
3. Rebuild with `bun run build`.
4. Verify the CSS output has real utility classes: `grep -c 'background-color\|max-width\|flex' dist/index.css` — should return a number greater than 10. If it returns 0–2, Tailwind still isn't scanning the right directory.

### Dev watcher breaks CSS styling

**Symptom:** Styles disappear after editing a file in `frontend/` during dev mode.

**Cause:** Bun's built-in CSS bundler runs on every rebuild and overwrites the CSS file that Tailwind CLI generated.

**Fix:** Set `bundleCss: false` in `config/frontend.ts` (see step 6). This tells the frontend build to skip CSS bundling entirely, letting Tailwind CLI be the sole CSS producer via `postBuild`.

### Tailwind CLI not found

```bash
bun add -d @tailwindcss/cli
```

### Typography styles not applied — article text unstyled

1. Check that `@tailwindcss/typography` is installed: `bun pm ls | grep typography`.
2. Check that the Tailwind CLI command includes `-p @tailwindcss/typography`.
3. Check that the blog HTML uses the `prose` class on the article body `<div>`.
4. If the `prose` class is present but styles are missing, run `bun run build` to regenerate CSS.

### Dark mode not working

The default template doesn't include dark mode — it's kept simple as a starting point. To add it, look at `scripts/build-blog.ts` in a project that has customized the templates, or add `dark:` Tailwind variants and a theme toggle script to your `layout()` function.

---

## File Structure After Install

```
your-project/
├── content/
│   └── posts/
│       ├── hello-world.md    # Example post
│       └── my-post.md        # Your posts go here
├── scripts/
│   └── build-blog.ts        # Blog build script (your copy — templates + orchestration)
├── frontend/
│   ├── index.ts              # TypeScript entry point
│   ├── styles.css            # Tailwind CSS imports
│   └── public/               # Static assets (images, fonts, etc.)
├── config/
│   └── frontend.ts           # Build config (copyHtml: false)
├── dist/                     # Built output (gitignored)
│   ├── index.html            # Post listing
│   ├── index.css             # Tailwind CSS with typography
│   ├── rss.xml               # RSS feed
│   └── posts/
│       └── hello-world/
│           └── index.html    # Individual post page
└── extensions/
    └── manifest-content-blog/
        ├── EXTENSION.md
        ├── services/
        │   ├── posts.ts      # Post loading & parsing
        │   ├── rss.ts        # RSS feed generation
        │   └── frontmatter.ts # YAML frontmatter parser
        ├── templates/
        │   ├── build-blog.ts # Template build script
        │   └── styles.css
        └── content/
            └── posts/
                └── hello-world.md
```
