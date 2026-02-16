/**
 * build-blog.ts — Generates a static blog from markdown files.
 *
 * Reads posts from content/posts/, parses YAML frontmatter, converts markdown
 * to HTML via marked, and outputs a complete static site to dist/.
 *
 * Usage: bun run scripts/build-blog.ts
 *
 * Run AFTER `bun manifest frontend build` (so dist/ has bundled JS/CSS)
 * and BEFORE Tailwind CLI (so it can scan the generated HTML for classes).
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { marked } from "marked";

// ---------------------------------------------------------------------------
// Site configuration — edit these for your blog
// ---------------------------------------------------------------------------

const SITE_TITLE = "My Blog";
const SITE_DESCRIPTION = "Thoughts, tutorials, and notes.";
const SITE_URL = "https://example.com";
const AUTHOR = "Your Name";

const SOCIAL_LINKS = {
  github: "https://github.com/yourname",
  twitter: "https://twitter.com/yourname",
  // email: "mailto:you@example.com",
  // linkedin: "https://linkedin.com/in/yourname",
  // rss: "/rss.xml",
};

const ABOUT_TEXT = `
  <p>Welcome to my blog. I write about software, technology, and whatever else comes to mind.</p>
  <p>Built with <a href="https://github.com/example/manifest" class="text-blue-600 dark:text-blue-400 underline">Manifest</a>.</p>
`;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const POSTS_DIR = "content/posts";
const OUTPUT_DIR = "dist";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostFrontmatter {
  title: string;
  slug: string;
  description: string;
  pubDatetime: string;
  draft?: boolean;
}

interface Post extends PostFrontmatter {
  content: string;
  html: string;
  readTime: number;
}

// ---------------------------------------------------------------------------
// Frontmatter parser (simple YAML subset — no dependency needed)
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, content: match[2] };
}

// ---------------------------------------------------------------------------
// Read and parse all posts
// ---------------------------------------------------------------------------

function loadPosts(): Post[] {
  if (!existsSync(POSTS_DIR)) {
    console.warn(`⚠ No posts directory found at ${POSTS_DIR}`);
    return [];
  }

  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const posts: Post[] = [];

  for (const file of files) {
    const raw = readFileSync(join(POSTS_DIR, file), "utf-8");
    const { data, content } = parseFrontmatter(raw);

    if (data.draft === "true") continue;

    const fm = data as unknown as PostFrontmatter;
    if (!fm.title || !fm.slug || !fm.pubDatetime) {
      console.warn(`⚠ Skipping ${file} — missing required frontmatter (title, slug, pubDatetime)`);
      continue;
    }

    const html = marked.parse(content) as string;
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.round(wordCount / 230));

    posts.push({ ...fm, content, html, readTime });
  }

  // Sort newest first
  posts.sort((a, b) => new Date(b.pubDatetime).getTime() - new Date(a.pubDatetime).getTime());
  return posts;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function socialLinksHtml(): string {
  const entries = Object.entries(SOCIAL_LINKS).filter(([, url]) => url);
  if (entries.length === 0) return "";
  return entries
    .map(([name, url]) => `<a href="${url}" class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors capitalize">${name}</a>`)
    .join('<span class="text-gray-300 dark:text-gray-600">·</span>');
}

function themeToggleScript(): string {
  return `
    <script>
      (function() {
        const key = 'blog-theme';
        function apply(theme) {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          localStorage.setItem(key, theme);
        }
        const saved = localStorage.getItem(key);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        apply(saved || (prefersDark ? 'dark' : 'light'));

        document.addEventListener('click', function(e) {
          if (e.target.closest('#theme-toggle')) {
            const isDark = document.documentElement.classList.contains('dark');
            apply(isDark ? 'light' : 'dark');
          }
        });
      })();
    </script>
  `;
}

function themeToggleButton(): string {
  return `
    <button id="theme-toggle" class="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" aria-label="Toggle theme">
      <svg class="w-5 h-5 block dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      <svg class="w-5 h-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
    </button>
  `;
}

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------

function layout(title: string, content: string, path: string = ""): string {
  const isHome = path === "" || path === "/";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}${isHome ? "" : ` — ${SITE_TITLE}`}</title>
  <meta name="description" content="${SITE_DESCRIPTION}">
  <link rel="stylesheet" href="/index.css">
  ${themeToggleScript()}
</head>
<body class="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col">
  <header class="border-b border-gray-200 dark:border-gray-800">
    <nav class="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-lg font-bold hover:text-gray-600 dark:hover:text-gray-300 transition-colors">${SITE_TITLE}</a>
      <div class="flex items-center gap-4">
        <a href="/" class="text-sm ${isHome ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"} transition-colors">Posts</a>
        <a href="/about/" class="text-sm ${path === "about" ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"} transition-colors">About</a>
        ${themeToggleButton()}
      </div>
    </nav>
  </header>

  <main class="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
    ${content}
  </main>

  <footer class="border-t border-gray-200 dark:border-gray-800">
    <div class="max-w-2xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span>© ${new Date().getFullYear()} ${AUTHOR}</span>
      <div class="flex items-center gap-3">${socialLinksHtml()}</div>
    </div>
  </footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Generate pages
// ---------------------------------------------------------------------------

function writePage(filePath: string, html: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, html);
}

function generateIndex(posts: Post[]): void {
  const postListHtml = posts
    .map(
      (p) => `
      <article class="py-6">
        <a href="/posts/${p.slug}/" class="group block">
          <time class="text-sm text-gray-500 dark:text-gray-400">${formatDate(p.pubDatetime)}</time>
          <span class="text-sm text-gray-400 dark:text-gray-500 ml-2">· ${p.readTime} min read</span>
          <h2 class="text-xl font-semibold mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${p.title}</h2>
          <p class="text-gray-600 dark:text-gray-400 mt-1">${p.description}</p>
        </a>
      </article>`
    )
    .join('<hr class="border-gray-100 dark:border-gray-800">');

  const content = posts.length === 0
    ? `<p class="text-gray-500 dark:text-gray-400">No posts yet. Add markdown files to <code>content/posts/</code>.</p>`
    : postListHtml;

  writePage(join(OUTPUT_DIR, "index.html"), layout(SITE_TITLE, content, "/"));
}

function generatePosts(posts: Post[]): void {
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const prev = posts[i + 1]; // older
    const next = posts[i - 1]; // newer

    const navHtml = `
      <nav class="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-between text-sm">
        ${prev ? `<a href="/posts/${prev.slug}/" class="text-blue-600 dark:text-blue-400 hover:underline">← ${prev.title}</a>` : "<span></span>"}
        ${next ? `<a href="/posts/${next.slug}/" class="text-blue-600 dark:text-blue-400 hover:underline">${next.title} →</a>` : "<span></span>"}
      </nav>
    `;

    const content = `
      <article>
        <header class="mb-8">
          <time class="text-sm text-gray-500 dark:text-gray-400">${formatDate(post.pubDatetime)}</time>
          <span class="text-sm text-gray-400 dark:text-gray-500 ml-2">· ${post.readTime} min read</span>
          <h1 class="text-3xl font-bold mt-2">${post.title}</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2 text-lg">${post.description}</p>
        </header>
        <div class="prose dark:prose-invert max-w-none">
          ${post.html}
        </div>
        ${navHtml}
      </article>
    `;

    writePage(join(OUTPUT_DIR, "posts", post.slug, "index.html"), layout(post.title, content, `posts/${post.slug}`));
  }
}

function generateAbout(): void {
  const content = `
    <h1 class="text-3xl font-bold mb-6">About</h1>
    <div class="prose dark:prose-invert max-w-none">
      ${ABOUT_TEXT}
    </div>
  `;

  writePage(join(OUTPUT_DIR, "about", "index.html"), layout("About", content, "about"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const posts = loadPosts();
generateIndex(posts);
generatePosts(posts);
generateAbout();

console.log(`✓ Blog built: ${posts.length} post${posts.length === 1 ? "" : "s"} → ${OUTPUT_DIR}/`);

// ---------------------------------------------------------------------------
// Verify Tailwind @source directive
// ---------------------------------------------------------------------------

const stylesPath = "frontend/styles.css";
if (existsSync(stylesPath)) {
  const stylesContent = readFileSync(stylesPath, "utf-8");
  if (!stylesContent.includes("@source")) {
    console.warn("");
    console.warn(`⚠ frontend/styles.css is missing @source "../dist";`);
    console.warn(`  Tailwind v4 scans for classes relative to the CSS file (frontend/).`);
    console.warn(`  Without @source, it won't find classes in the generated HTML in dist/.`);
    console.warn(`  Add this line after @import "tailwindcss":`);
    console.warn(`    @source "../dist";`);
  }
}
