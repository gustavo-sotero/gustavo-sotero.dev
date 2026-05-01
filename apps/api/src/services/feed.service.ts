/**
 * Service layer for the RSS 2.0 feed.
 *
 * Encapsulates all domain logic for building the feed XML:
 * DB query for published posts, XML escaping, and cache management.
 * The feed route delegates entirely to this service.
 */

import { posts } from '@portfolio/shared/db/schema';
import { and, desc } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { cached } from '../lib/cache';
import { publicPostVisibilityClauses } from '../repositories/posts.repo';

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
 * Build and cache the RSS 2.0 feed XML.
 * Returns the full XML string including the XML declaration.
 */
export async function buildFeedXml(): Promise<string> {
  const siteUrl = env.ALLOWED_ORIGIN;
  const apiUrl = env.API_PUBLIC_URL;

  return cached(FEED_CACHE_KEY, FEED_TTL, async () => {
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
}
