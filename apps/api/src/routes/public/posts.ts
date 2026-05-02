/**
 * Public routes for posts (authenticated reads not required).
 *
 * Routes:
 *  GET /posts              - Paginated list of published posts (optional tag filter)
 *  GET /posts/:slug        - Post detail with initial comment preview + commentCount
 *  GET /posts/:slug/comments - Paginated approved comments for a post
 */

import { postQuerySchema } from '@portfolio/shared/schemas/posts';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  errorResponse,
  paginatedResponse,
  successResponse,
  windowedResponse,
} from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { getPostComments } from '../../services/comments.service';
import { getPostBySlug, listPosts } from '../../services/posts.service';
import type { AppEnv } from '../../types/index';

const publicPostsRouter = new Hono<AppEnv>();

/**
 * GET /posts
 * Returns published posts with previous/next navigation metadata. Supports `?page`, `?perPage`, `?tag`.
 * Results are cached by page/perPage/tag (TTL 5 min).
 */
publicPostsRouter.get('/', async (c) => {
  const qv = validateQuery(c, postQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    sort: c.req.query('sort'),
    // status is not exposed on public routes — always "published"
  });
  if (!qv.ok) return qv.response;

  // Force public mode: only published, no status filter.
  // Skip COUNT(*) and heavy content fields — not needed for list cards.
  const result = await listPosts(
    { page: qv.data.page, perPage: qv.data.perPage, tag: qv.data.tag, sort: qv.data.sort },
    false,
    { includeTotal: false, summaryOnly: true }
  );
  return windowedResponse(c, result.data, result.meta);
});

/**
 * GET /posts/:slug
 * Returns a published post with initial comment preview (≤30) plus commentCount.
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

const commentPageSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
});

/**
 * GET /posts/:slug/comments
 * Returns paginated approved comments for a published post.
 * Use this endpoint to load additional comments beyond the initial preview
 * included in the post detail payload.
 */
publicPostsRouter.get('/:slug/comments', async (c) => {
  const slug = c.req.param('slug');

  const qv = validateQuery(c, commentPageSchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
  });
  if (!qv.ok) return qv.response;

  const result = await getPostComments(slug, qv.data.page, qv.data.perPage);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  return paginatedResponse(c, result.data, result.meta);
});

export { publicPostsRouter };
