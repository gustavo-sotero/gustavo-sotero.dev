/**
 * Admin routes for analytics data.
 *
 * Routes:
 *  GET /admin/analytics/summary   - Pageview count + content counts for a date range
 *  GET /admin/analytics/top-posts - Top paths by view count for a date range
 */

import { comments, posts, projects } from '@portfolio/shared/db/schema';
import { count as drizzleCount, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../config/db';
import { cached } from '../../lib/cache';
import { errorResponse, successResponse } from '../../lib/response';
import { getPageviewCount, getTopPaths } from '../../repositories/analytics.repo';
import type { AppEnv } from '../../types/index';

const adminAnalyticsRouter = new Hono<AppEnv>();

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((value) => !Number.isNaN(value.getTime()), 'Invalid date');

const summaryQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

const topPostsQuerySchema = summaryQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function mapZodIssuesToDetails(error: z.ZodError): Array<{ field?: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Normalize a Date to a YYYY-MM-DD string for stable cache keys.
 * Millisecond-precision ISO strings would produce near-cache-miss for every
 * request even with the same logical date window.
 */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /admin/analytics/summary
 * Returns pageview count, pending comments count, published posts and projects.
 * Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 30 days).
 */
adminAnalyticsRouter.get('/summary', async (c) => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parsed = summaryQuerySchema.safeParse({
    from: c.req.query('from'),
    to: c.req.query('to'),
  });

  if (!parsed.success) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Invalid query parameters',
      mapZodIssuesToDetails(parsed.error)
    );
  }

  const from = parsed.data.from ?? defaultFrom;
  const to = parsed.data.to ?? now;

  if (from > to) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', '"from" must be before "to"');
  }

  // Normalize to date-only keys: two requests for "today 09:00" and "today 09:01"
  // resolve to the same cache entry instead of thrashing on millisecond precision.
  const cacheKey = `analytics:summary:${toDateKey(from)}:${toDateKey(to)}`;

  const data = await cached(cacheKey, 300, async () => {
    const [pageviews, publishedPosts, publishedProjects, pendingCommentsResult] = await Promise.all(
      [
        getPageviewCount({ from, to }),
        db
          .select({ total: drizzleCount() })
          .from(posts)
          .where(eq(posts.status, 'published'))
          .then(([r]) => r?.total ?? 0),
        db
          .select({ total: drizzleCount() })
          .from(projects)
          .where(eq(projects.status, 'published'))
          .then(([r]) => r?.total ?? 0),
        db
          .select({ total: drizzleCount() })
          .from(comments)
          .where(eq(comments.status, 'pending'))
          .then(([r]) => r?.total ?? 0),
      ]
    );

    return {
      pageviews,
      pendingComments: pendingCommentsResult,
      publishedPosts,
      publishedProjects,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  });

  return successResponse(c, data);
});

/**
 * GET /admin/analytics/top-posts
 * Returns top paths ranked by view count for a date range.
 * Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10`.
 */
adminAnalyticsRouter.get('/top-posts', async (c) => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parsed = topPostsQuerySchema.safeParse({
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Invalid query parameters',
      mapZodIssuesToDetails(parsed.error)
    );
  }

  const from = parsed.data.from ?? defaultFrom;
  const to = parsed.data.to ?? now;
  const limit = parsed.data.limit ?? 10;

  if (from > to) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', '"from" must be before "to"');
  }

  const cacheKey = `analytics:top-posts:${toDateKey(from)}:${toDateKey(to)}:${limit}`;

  const rows = await cached(cacheKey, 300, async () => {
    return getTopPaths({ from, to, limit });
  });

  return successResponse(c, rows);
});

export { adminAnalyticsRouter };
