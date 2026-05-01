/**
 * Service layer for the XML sitemap.
 *
 * Encapsulates all domain logic for building the sitemap XML:
 * parallel DB queries for published posts and projects, static
 * page entries, XML escaping, and cache management.
 * The sitemap route delegates entirely to this service.
 */

import { posts, projects } from '@portfolio/shared/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { cached } from '../lib/cache';
import { publicPostVisibilityClauses } from '../repositories/posts.repo';

const SITEMAP_TTL = 3600; // 1 hour
const SITEMAP_CACHE_KEY = 'sitemap:xml';

/** Format a Date as ISO 8601 (YYYY-MM-DD) for sitemap `<lastmod>`. */
function toIsoDate(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0] as string;
}

/** Escape special XML characters for URL content. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build and cache the XML sitemap.
 * Returns the full XML string including the XML declaration.
 */
export async function buildSitemapXml(): Promise<string> {
  const siteUrl = env.ALLOWED_ORIGIN;
  const apiUrl = env.API_PUBLIC_URL;

  return cached(SITEMAP_CACHE_KEY, SITEMAP_TTL, async () => {
    const [publishedPosts, publishedProjects] = await Promise.all([
      db
        .select({ slug: posts.slug, updatedAt: posts.updatedAt })
        .from(posts)
        .where(and(...publicPostVisibilityClauses())),
      db
        .select({ slug: projects.slug, updatedAt: projects.updatedAt })
        .from(projects)
        .where(and(eq(projects.status, 'published'), isNull(projects.deletedAt))),
    ]);

    const today = toIsoDate(new Date());

    const staticUrls: Array<{ loc: string; lastmod: string }> = [
      { loc: `${siteUrl}/`, lastmod: today },
      { loc: `${siteUrl}/projects`, lastmod: today },
      { loc: `${siteUrl}/blog`, lastmod: today },
      { loc: `${siteUrl}/contact`, lastmod: today },
      { loc: `${apiUrl}/doc`, lastmod: today },
    ];

    const postUrls = publishedPosts.map((p) => ({
      loc: `${siteUrl}/blog/${p.slug}`,
      lastmod: toIsoDate(p.updatedAt),
    }));

    const projectUrls = publishedProjects.map((p) => ({
      loc: `${siteUrl}/projects/${p.slug}`,
      lastmod: toIsoDate(p.updatedAt),
    }));

    const allUrls = [...staticUrls, ...postUrls, ...projectUrls];

    const urlEntries = allUrls
      .map(({ loc, lastmod }) =>
        [
          '  <url>',
          `    <loc>${escapeXml(loc)}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '  </url>',
        ].join('\n')
      )
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urlEntries,
      '</urlset>',
    ].join('\n');
  });
}
