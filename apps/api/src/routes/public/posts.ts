/**
 * Public routes for posts (authenticated reads not required).
 *
 * Routes:
 *  GET /posts         - Paginated list of published posts (optional tag filter)
 *  GET /posts/:slug   - Post detail with approved comments
 */

import { postQuerySchema } from '@portfolio/shared/schemas/posts';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { getPostBySlug, listPosts } from '../../services/posts.service';
import type { AppEnv } from '../../types/index';

const publicPostsRouter = new Hono<AppEnv>();

/**
 * GET /posts
 * Returns paginated published posts. Supports `?page`, `?perPage`, `?tag`.
 * Results are cached by page/perPage/tag (TTL 5 min).
 */
publicPostsRouter.get('/', async (c) => {
  const queryParsed = postQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    // status is not exposed on public routes — always "published"
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  // Force public mode: only published, no status filter
  const result = await listPosts(queryParsed.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /posts/:slug
 * Returns a published post with its pre-rendered HTML content and approved comments.
 * Cached for 1 hour.
 */
publicPostsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await getPostBySlug(slug, false);

  if (!post) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  return successResponse(c, post);
});

export { publicPostsRouter };
