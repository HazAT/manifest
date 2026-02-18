/**
 * build-blog.ts — Generates a static blog from markdown files.
 *
 * Uses the manifest-content-blog extension services for post loading
 * and RSS generation. Templates are inline below — edit them freely.
 *
 * Usage: bun run scripts/build-blog.ts
 *
 * Run AFTER `bun run build` (so dist/ has bundled JS/CSS)
 * and BEFORE Tailwind CLI (so it can scan the generated HTML for classes).
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { loadPosts, type Post } from "../extensions/manifest-content-blog/services/posts"
import { generateRss } from "../extensions/manifest-content-blog/services/rss"

// ---------------------------------------------------------------------------
// Site configuration — edit these for your blog
// ---------------------------------------------------------------------------

const SiteConfig = {
  title: "My Blog",
  description: "Thoughts, tutorials, and notes.",
  url: "https://example.com",
  author: "Your Name",
}

const POSTS_DIR = "content/posts"
const OUTPUT_DIR = "dist"

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

// ---------------------------------------------------------------------------
// Page templates — edit these to change your blog's look
// ---------------------------------------------------------------------------

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${SiteConfig.description}">
  <link rel="stylesheet" href="/index.css">
  <link rel="alternate" type="application/rss+xml" title="${SiteConfig.title}" href="/rss.xml">
</head>
<body class="bg-white text-gray-900 min-h-screen flex flex-col">
  <header class="border-b border-gray-200">
    <nav class="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-lg font-bold">${SiteConfig.title}</a>
      <a href="/rss.xml" class="text-sm text-gray-500 hover:text-gray-900">RSS</a>
    </nav>
  </header>
  <main class="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">${content}</main>
  <footer class="border-t border-gray-200">
    <div class="max-w-2xl mx-auto px-4 py-6 text-sm text-gray-500 text-center">
      © ${new Date().getFullYear()} ${SiteConfig.author}
    </div>
  </footer>
</body>
</html>`
}

function indexPage(posts: Post[]): string {
  if (posts.length === 0) {
    return layout(SiteConfig.title, `<p class="text-gray-500">No posts yet. Add markdown files to <code>content/posts/</code>.</p>`)
  }
  const list = posts.map(p => `
    <article class="py-5">
      <a href="/posts/${p.slug}/" class="group block">
        <time class="text-sm text-gray-500">${formatDate(p.pubDatetime)}</time>
        <span class="text-sm text-gray-400 ml-2">· ${p.readTime} min read</span>
        <h2 class="text-xl font-semibold mt-1 group-hover:text-blue-600">${p.title}</h2>
        ${p.description ? `<p class="text-gray-600 mt-1">${p.description}</p>` : ""}
      </a>
    </article>`).join('<hr class="border-gray-100">')
  return layout(SiteConfig.title, list)
}

function postPage(post: Post, prev: Post | null, next: Post | null): string {
  const nav = (prev || next) ? `
    <nav class="mt-12 pt-6 border-t border-gray-200 flex justify-between text-sm">
      ${prev ? `<a href="/posts/${prev.slug}/" class="text-blue-600 hover:underline">← ${prev.title}</a>` : "<span></span>"}
      ${next ? `<a href="/posts/${next.slug}/" class="text-blue-600 hover:underline">${next.title} →</a>` : "<span></span>"}
    </nav>` : ""
  const content = `
    <article>
      <header class="mb-8">
        <time class="text-sm text-gray-500">${formatDate(post.pubDatetime)}</time>
        <span class="text-sm text-gray-400 ml-2">· ${post.readTime} min read</span>
        <h1 class="text-3xl font-bold mt-2">${post.title}</h1>
        ${post.description ? `<p class="text-gray-600 mt-2 text-lg">${post.description}</p>` : ""}
      </header>
      <div class="prose max-w-none">${post.html}</div>
      ${nav}
    </article>`
  return layout(post.title + ` — ${SiteConfig.title}`, content)
}

// ---------------------------------------------------------------------------
// Build orchestration
// ---------------------------------------------------------------------------

function writePage(filePath: string, html: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"))
  mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, html)
}

const posts = loadPosts({ postsDir: POSTS_DIR })

// Index page
writePage(join(OUTPUT_DIR, "index.html"), indexPage(posts))

// Individual post pages
for (let i = 0; i < posts.length; i++) {
  const prev = i < posts.length - 1 ? posts[i + 1] : null
  const next = i > 0 ? posts[i - 1] : null
  writePage(join(OUTPUT_DIR, "posts", posts[i].slug, "index.html"), postPage(posts[i], prev, next))
}

// RSS feed
writeFileSync(join(OUTPUT_DIR, "rss.xml"), generateRss({
  posts, siteTitle: SiteConfig.title, siteDescription: SiteConfig.description, siteUrl: SiteConfig.url,
}))

console.log(`✓ Blog built: ${posts.length} post${posts.length === 1 ? "" : "s"} → ${OUTPUT_DIR}/`)

// Verify @source directive
const stylesPath = "frontend/styles.css"
if (existsSync(stylesPath)) {
  const stylesContent = readFileSync(stylesPath, "utf-8")
  if (!stylesContent.includes("@source")) {
    console.warn("")
    console.warn(`⚠ frontend/styles.css is missing @source "../dist";`)
    console.warn(`  Add this line after @import "tailwindcss":`)
    console.warn(`    @source "../dist";`)
  }
}
