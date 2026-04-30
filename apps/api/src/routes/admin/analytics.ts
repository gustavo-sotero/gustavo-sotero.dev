/**
 * Admin routes for analytics data.
 *
 * Routes:
 *  GET /admin/analytics/summary   - Pageview count + content counts for a date range
 *  GET /admin/analytics/top-posts - Top paths by view count for a date range
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { errorResponse, successResponse } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { getAnalyticsSummary, getAnalyticsTopPosts } from '../../services/analytics.service';
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

/**
 * GET /admin/analytics/summary
 * Returns pageview count, pending comments count, published posts and projects.
 * Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 30 days).
 */
adminAnalyticsRouter.get('/summary', async (c) => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const qv = validateQuery(c, summaryQuerySchema, {
    from: c.req.query('from'),
    to: c.req.query('to'),
  });
  if (!qv.ok) return qv.response;

  const from = qv.data.from ?? defaultFrom;
  const to = qv.data.to ?? now;

  if (from > to) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', '"from" must be before "to"');
  }

  const data = await getAnalyticsSummary({ from, to });
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

  const qv = validateQuery(c, topPostsQuerySchema, {
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit'),
  });
  if (!qv.ok) return qv.response;

  const from = qv.data.from ?? defaultFrom;
  const to = qv.data.to ?? now;
  const limit = qv.data.limit ?? 10;

  if (from > to) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', '"from" must be before "to"');
  }

  const rows = await getAnalyticsTopPosts({ from, to, limit });
  return successResponse(c, rows);
});

export { adminAnalyticsRouter };
