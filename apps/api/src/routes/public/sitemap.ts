/**
 * XML Sitemap for public pages and published content.
 *
 * Route: GET /sitemap.xml
 * Includes static public routes plus all published posts and projects.
 * Cached in Redis for 1 hour; invalidated when posts/projects are mutated.
 */

import { Hono } from 'hono';
import { buildSitemapXml } from '../../services/sitemap.service';
import type { AppEnv } from '../../types/index';

const sitemapRouter = new Hono<AppEnv>();

/**
 * GET /sitemap.xml
 * XML sitemap including static pages and all published post/project detail pages.
 */
sitemapRouter.get('/sitemap.xml', async (c) => {
  const xml = await buildSitemapXml();
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
  });
});

export { sitemapRouter };
