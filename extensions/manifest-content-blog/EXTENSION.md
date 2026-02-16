---
name: manifest-content-blog
version: 0.1.0
description: "Markdown blog with static HTML output. Posts in content/posts/, built with marked + Tailwind Typography."
author: "Manifest"
requires:
  - manifest-frontend-static
---

# Content Blog Extension

Markdown files in `content/posts/` → static HTML blog. Parses YAML frontmatter, converts to HTML via `marked`, generates index + post pages + about page. Dark/light theme toggle, read time, prev/next navigation, social links.

Best for: personal blogs, dev blogs, project blogs — any site where content lives in markdown.

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

### 3. Copy the build script

```bash
mkdir -p scripts
cp extensions/manifest-content-blog/templates/build-blog.ts scripts/build-blog.ts
```

This is your file now. Edit it to change site title, social links, about text, and page templates.

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

- `marked` — markdown to HTML conversion
- `@tailwindcss/cli` — standalone Tailwind CLI (runs after blog build to scan generated HTML)
- `@tailwindcss/typography` — the `prose` class for styled article content

### 6. Disable HTML copying

In `config/frontend.ts`, add `copyHtml: false`:

```typescript
export default {
  entryPoint: 'frontend/index.ts',
  outputDir: 'dist',
  sourceMaps: true,
  spaFallback: false,
  devReload: true,
  copyHtml: false,
}
```

The blog build script generates all HTML files. Setting `copyHtml: false` prevents the frontend build from copying `frontend/*.html` into `dist/` and overwriting them.

Also set `spaFallback: false` — the blog is a multi-page site, not a single-page app.

### 7. Set up the build pipeline

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "build": "bun manifest frontend build && bun run scripts/build-blog.ts && bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css -p @tailwindcss/typography",
    "dev": "bun --hot index.ts"
  }
}
```

The build pipeline runs three steps in order:

1. **`bun manifest frontend build`** — Bundles TypeScript and CSS into `dist/`
2. **`bun run scripts/build-blog.ts`** — Reads markdown, generates HTML pages in `dist/`
3. **`bunx @tailwindcss/cli ...`** — Scans all generated HTML for Tailwind classes and rebuilds CSS with typography plugin

The order matters. Tailwind CLI runs last so it can scan the HTML that the blog script generated.

### 8. Build and verify

```bash
bun run build
```

You should see:
- `dist/index.html` — the post listing
- `dist/posts/hello-world/index.html` — the example post
- `dist/about/index.html` — the about page
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

```
content/posts/*.md          frontend/styles.css
       │                           │
       ▼                           │
  build-blog.ts                    │
  (markdown → HTML)                │
       │                           │
       ▼                           ▼
    dist/*.html ──────────→ Tailwind CLI
                           (scans HTML for classes)
                                   │
                                   ▼
                            dist/index.css
```

1. **Frontend build** (`bun manifest frontend build`) — bundles your TypeScript entry point and copies static assets from `frontend/public/` to `dist/`.

2. **Blog build** (`bun run scripts/build-blog.ts`) — reads every `.md` file in `content/posts/`, parses frontmatter, converts markdown to HTML with `marked`, and writes complete HTML pages to `dist/`. Generates the index page (all posts sorted by date), individual post pages with prev/next navigation, and an about page.

3. **Tailwind CLI** (`bunx @tailwindcss/cli -i frontend/styles.css -o dist/index.css -p @tailwindcss/typography`) — scans all files in `dist/` for Tailwind utility classes and generates the final CSS. The `@tailwindcss/typography` plugin provides the `prose` class used for article body styling.

---

## Customizing the Build Script

The build script at `scripts/build-blog.ts` is yours to edit. Common customizations:

**Site metadata** — Edit the constants at the top of the file:

```typescript
const SITE_TITLE = "My Blog";
const SITE_DESCRIPTION = "Thoughts, tutorials, and notes.";
const AUTHOR = "Your Name";
```

**Social links** — Add or remove entries:

```typescript
const SOCIAL_LINKS = {
  github: "https://github.com/yourname",
  twitter: "https://twitter.com/yourname",
  email: "mailto:you@example.com",
};
```

**About page** — Edit the `ABOUT_TEXT` HTML string.

**Page templates** — The `layout()`, `generateIndex()`, `generatePosts()`, and `generateAbout()` functions contain the HTML templates. Edit them directly — there's no template engine to learn.

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

The three build steps must run in order. If you run them separately, make sure:

1. `bun manifest frontend build` runs first
2. `bun run scripts/build-blog.ts` runs second
3. `bunx @tailwindcss/cli ...` runs last

If CSS is empty or missing `prose` styles, first check the `@source` directive (see below), then check build order. Run the full `bun run build` pipeline.

### Tailwind classes not applied — site unstyled or layout broken

This is the most common issue. Tailwind v4 scans for utility classes **relative to the CSS file's location**. Since `styles.css` is in `frontend/`, Tailwind only scans `frontend/` by default — but the generated HTML lives in `dist/`.

1. Open `frontend/styles.css` and check for `@source "../dist";` near the top (after `@import "tailwindcss"`).
2. If it's missing, add it:
   ```css
   @import "tailwindcss";
   @source "../dist";
   ```
3. Rebuild with `bun run build`.
4. Verify the CSS output has real utility classes: `grep -c 'background-color\|max-width\|flex' dist/index.css` — should return a number greater than 10. If it returns 0–2, Tailwind still isn't scanning the right directory.

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

The theme toggle script runs inline in `<head>` to avoid a flash of wrong theme. Check:

1. The `<script>` tag is present in the HTML `<head>`.
2. `localStorage` is not blocked (private/incognito mode may behave differently).
3. The `dark:` Tailwind variants are present in the generated CSS — if not, rebuild with `bun run build`.

---

## File Structure After Install

```
your-project/
├── content/
│   └── posts/
│       ├── hello-world.md    # Example post
│       └── my-post.md        # Your posts go here
├── scripts/
│   └── build-blog.ts        # Blog build script (your copy)
├── frontend/
│   ├── index.ts              # TypeScript entry point
│   ├── styles.css            # Tailwind CSS imports
│   └── public/               # Static assets (images, fonts, etc.)
├── config/
│   └── frontend.ts           # Build config (copyHtml: false)
├── dist/                     # Built output (gitignored)
│   ├── index.html            # Post listing
│   ├── index.css             # Tailwind CSS with typography
│   ├── about/
│   │   └── index.html        # About page
│   └── posts/
│       └── hello-world/
│           └── index.html    # Individual post page
└── extensions/
    └── manifest-content-blog/
        ├── EXTENSION.md
        ├── templates/
        │   ├── build-blog.ts
        │   └── styles.css
        └── content/
            └── posts/
                └── hello-world.md
```
