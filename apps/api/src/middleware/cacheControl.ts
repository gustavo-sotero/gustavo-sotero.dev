/**
 * Cache-Control header middleware.
 *
 * Applies appropriate `Cache-Control` headers based on the request path:
 *  - Admin routes              → `no-store, private` (never cache sensitive data)
 *  - Public detail endpoints   → `public, s-maxage=3600, stale-while-revalidate=300`
 *  - Public listing endpoints  → `public, s-maxage=300, stale-while-revalidate=60`
 *  - Feed/Sitemap              → headers set directly in handlers (already 3600s)
 *  - Health/Ready/Static       → no cache directive set (platform defaults apply)
 */

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/index';

/** Routes where we detect a "detail" structure (slug or ID in path). */
const DETAIL_PATH_RE = /^\/(posts|projects)\/[^/]+/;

/** Listing endpoints (exact path prefixes, no dynamic segment). */
const LISTING_PATHS = new Set(['/posts', '/projects', '/tags']);

/**
 * Sets `Cache-Control` headers based on the matched route type.
 *
 * Must be registered before routes so the header is added on the response.
 */
export const cacheControlMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();

  const path = c.req.path;

  // Admin routes: always prevent caching (sensitive data, auth-gated)
  if (path.startsWith('/admin') || path.startsWith('/auth')) {
    c.header('Cache-Control', 'no-store, private');
    return;
  }

  // Feed/Sitemap: headers set directly in the handlers — skip override
  if (path === '/feed.xml' || path === '/sitemap.xml') {
    return;
  }

  // Public detail: slug-based resource (longer TTL)
  if (DETAIL_PATH_RE.test(path)) {
    c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return;
  }

  // Public listing: paginated/filtered collection (shorter TTL)
  const basePath = path.split('?')[0];
  if (LISTING_PATHS.has(basePath as string)) {
    c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return;
  }
};
