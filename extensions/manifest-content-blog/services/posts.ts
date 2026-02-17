import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { marked } from "marked";
import { parseFrontmatter } from "./frontmatter";

/** Frontmatter fields expected in a blog post markdown file. */
export interface PostFrontmatter {
  title: string;
  slug: string;
  description: string;
  pubDatetime: string;
  draft?: boolean;
  author?: string;
}

/** A fully parsed blog post with rendered HTML and computed read time. */
export interface Post extends PostFrontmatter {
  /** The raw markdown content (without frontmatter). */
  content: string;
  /** HTML rendered from the markdown content via `marked`. */
  html: string;
  /** Estimated reading time in minutes (minimum 1). */
  readTime: number;
}

/**
 * Loads and parses all markdown posts from a directory.
 *
 * Reads every `.md` file in `postsDir`, parses frontmatter, converts
 * markdown to HTML via `marked`, calculates read time (230 words/min),
 * filters out drafts, warns on missing required fields, and returns
 * posts sorted by date (newest first).
 */
export function loadPosts(opts: { postsDir: string }): Post[] {
  const { postsDir } = opts;

  if (!existsSync(postsDir)) {
    console.warn(`⚠ No posts directory found at ${postsDir}`);
    return [];
  }

  const files = readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  const posts: Post[] = [];

  for (const file of files) {
    const raw = readFileSync(join(postsDir, file), "utf-8");
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

  posts.sort((a, b) => new Date(b.pubDatetime).getTime() - new Date(a.pubDatetime).getTime());
  return posts;
}
