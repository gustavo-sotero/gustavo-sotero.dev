/**
 * Admin routes for posts management (all statuses, soft delete).
 *
 * These routes are protected by `authAdmin` + CSRF middleware applied globally
 * in app.ts for all /admin/* paths. There is no need to re-apply those
 * middleware here.
 *
 * Routes:
 *  GET    /admin/posts          - List posts (all statuses, with pagination)
 *  POST   /admin/posts          - Create a post
 *  PATCH  /admin/posts/:id      - Update a post
 *  DELETE /admin/posts/:id      - Soft-delete a post
 */

import {
  createPostSchema,
  postQuerySchema,
  updatePostSchema,
} from '@portfolio/shared/schemas/posts';
import { Hono } from 'hono';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import {
  createPostService,
  getPostBySlug,
  listPosts,
  softDeletePostService,
  updatePostService,
} from '../../services/posts.service';
import type { AppEnv } from '../../types/index';

const adminPostsRouter = new Hono<AppEnv>();

/**
 * GET /admin/posts
 * List all posts (including drafts) with optional status/tag filters and pagination.
 */
adminPostsRouter.get('/', async (c) => {
  const queryParsed = postQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    status: c.req.query('status'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listPosts(queryParsed.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/posts
 * Create a new post. Returns 201 with the created resource.
 */
adminPostsRouter.post('/', async (c) => {
  const bodyResult = await parseBodyResult(c);
  if (!bodyResult.ok) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      bodyResult.error.message,
      bodyResult.error.details
    );
  }

  const parsed = createPostSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const post = await createPostService(parsed.data);
    return successResponse(c, post, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    throw err;
  }
});

/**
 * GET /admin/posts/:slug
 * Get a single post by slug (admin — includes drafts).
 */
adminPostsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await getPostBySlug(slug, true);

  if (!post) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  return successResponse(c, post);
});

/**
 * PATCH /admin/posts/:id
 * Update an existing post by numeric ID.
 */
adminPostsRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid post ID');
  }

  const bodyResult = await parseBodyResult(c);
  if (!bodyResult.ok) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      bodyResult.error.message,
      bodyResult.error.details
    );
  }

  const parsed = updatePostSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const updated = await updatePostService(id, parsed.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    throw err;
  }
});

/**
 * DELETE /admin/posts/:id
 * Soft-delete a post by numeric ID. Returns 204 No Content.
 */
adminPostsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid post ID');
  }

  const result = await softDeletePostService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  return c.body(null, 204);
});

export { adminPostsRouter };
