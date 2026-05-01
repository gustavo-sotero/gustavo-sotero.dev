/**
 * RSS 2.0 feed for published blog posts.
 *
 * Route: GET /feed.xml
 * Returns the 20 most recently published posts as an RSS 2.0 document.
 * Cached in Redis for 1 hour; invalidated when posts are mutated.
 */

import { Hono } from 'hono';
import { buildFeedXml } from '../../services/feed.service';
import type { AppEnv } from '../../types/index';

const feedRouter = new Hono<AppEnv>();

/**
 * GET /feed.xml
 * RSS 2.0 feed of the 20 most recent published posts.
 */
feedRouter.get('/feed.xml', async (c) => {
  const xml = await buildFeedXml();
  return c.body(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
  });
});

export { feedRouter };
