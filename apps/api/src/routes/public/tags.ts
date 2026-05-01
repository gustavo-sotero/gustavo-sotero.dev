/**
 * Public route for tags.
 *
 * Returns only tags that are actually used by at least one published post.
 * Supports optional category and source filters.
 *
 * Route:
 *  GET /tags  - List tags used by published posts
 */

import { publicTagQuerySchema } from '@portfolio/shared/schemas/tags';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { listTags } from '../../services/tags.service';
import type { AppEnv } from '../../types/index';

const publicTagsRouter = new Hono<AppEnv>();

/**
 * GET /tags
 * Returns tags that appear on at least one published post.
 * Supports `?category=language,framework` (comma-separated category filter).
 * Supports `?source=post` (tags are post-only taxonomy; project/experience use skills).
 * When `source` is absent, all post-used tags are returned.
 * Cached for 5 minutes.
 */
publicTagsRouter.get('/', async (c) => {
  const qv = validateQuery(c, publicTagQuerySchema, {
    category: c.req.query('category'),
    source: c.req.query('source'),
  });
  if (!qv.ok) return qv.response;

  const result = await listTags(qv.data, true, { includeTotal: false });
  return successResponse(c, result.data);
});

export { publicTagsRouter };
