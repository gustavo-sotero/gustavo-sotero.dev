/**
 * RSS 2.0 feed for published blog posts.
 *
 * Route: GET /feed.xml
 * Returns the 20 most recently published posts as an RSS 2.0 document.
 * Cached in Redis for 1 hour; invalidated when posts are mutated.
 */

import { posts } from '@portfolio/shared/db/schema';
import { and, desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { cached } from '../../lib/cache';
import { publicPostVisibilityClauses } from '../../repositories/posts.repo';
import type { AppEnv } from '../../types/index';

const feedRouter = new Hono<AppEnv>();

const FEED_TTL = 3600; // 1 hour
const FEED_CACHE_KEY = 'feed:rss';
const FEED_MAX_ITEMS = 20;

/** Escape special XML characters to produce valid XML content. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a Date as RFC 822 for RSS `<pubDate>`. */
function toRfc822(date: Date | string): string {
  return new Date(date).toUTCString();
}

/**
 * GET /feed.xml
 * RSS 2.0 feed of the 20 most recent published posts.
 */
feedRouter.get('/feed.xml', async (c) => {
  const siteUrl = env.ALLOWED_ORIGIN;
  const apiUrl = env.API_PUBLIC_URL;

  const xml = await cached(FEED_CACHE_KEY, FEED_TTL, async () => {
    const rows = await db
      .select({
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(and(...publicPostVisibilityClauses()))
      .orderBy(desc(posts.publishedAt))
      .limit(FEED_MAX_ITEMS);

    const items = rows
      .map((row) => {
        const link = `${siteUrl}/blog/${escapeXml(row.slug)}`;
        const title = escapeXml(row.title);
        const description = row.excerpt ? escapeXml(row.excerpt) : '';
        const pubDate = row.publishedAt ? toRfc822(row.publishedAt) : toRfc822(row.updatedAt);
        const guid = link;

        return [
          '    <item>',
          `      <title>${title}</title>`,
          `      <link>${link}</link>`,
          `      <description>${description}</description>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <guid isPermaLink="true">${guid}</guid>`,
          '    </item>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      `    <title>Blog — Portfolio</title>`,
      `    <link>${escapeXml(siteUrl)}/blog</link>`,
      `    <description>Technical articles and insights</description>`,
      `    <language>pt-BR</language>`,
      `    <atom:link href="${escapeXml(apiUrl)}/feed.xml" rel="self" type="application/rss+xml"/>`,
      items,
      '  </channel>',
      '</rss>',
    ].join('\n');
  });

  return c.body(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
  });
});

export { feedRouter };
