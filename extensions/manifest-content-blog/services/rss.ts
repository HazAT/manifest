import type { Post } from "./posts";

/**
 * Generates an RSS 2.0 XML feed from a list of blog posts.
 *
 * Returns the complete XML string — the caller is responsible for
 * writing it to disk. All site-specific values (title, description,
 * URL) are passed as parameters so the service stays reusable.
 */
export function generateRss(opts: {
  posts: Post[];
  siteTitle: string;
  siteDescription: string;
  siteUrl: string;
}): string {
  const { posts, siteTitle, siteDescription, siteUrl } = opts;

  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${siteUrl}/posts/${p.slug}/</link>
      <guid>${siteUrl}/posts/${p.slug}/</guid>
      <description><![CDATA[${p.description}]]></description>
      <pubDate>${new Date(p.pubDatetime).toUTCString()}</pubDate>
    </item>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${siteUrl}</link>
    <description>${siteDescription}</description>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}
