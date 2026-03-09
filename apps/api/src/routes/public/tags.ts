/**
 * Public route for tags.
 *
 * Returns only tags that are actually used by at least one published post
 * or project. Supports optional category filter.
 *
 * Route:
 *  GET /tags  - List tags used by published content
 */

import { tagQuerySchema } from '@portfolio/shared/schemas/tags';
import { Hono } from 'hono';
import { errorResponse, successResponse } from '../../lib/response';
import { listTags } from '../../services/tags.service';
import type { AppEnv } from '../../types/index';

const publicTagsRouter = new Hono<AppEnv>();

/**
 * GET /tags
 * Returns tags that appear on at least one published post or project.
 * Supports `?category=language,framework` (comma-separated category filter).
 * Cached for 5 minutes.
 */
publicTagsRouter.get('/', async (c) => {
  const queryParsed = tagQuerySchema.safeParse({
    category: c.req.query('category'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listTags(queryParsed.data, true);
  return successResponse(c, result.data);
});

export { publicTagsRouter };
