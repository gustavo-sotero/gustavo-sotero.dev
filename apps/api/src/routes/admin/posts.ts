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
import { validateBody, validateQuery } from '../../lib/validate';
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
  const qv = validateQuery(c, postQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    status: c.req.query('status'),
  });
  if (!qv.ok) return qv.response;

  const result = await listPosts(qv.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/posts
 * Create a new post. Returns 201 with the created resource.
 */
adminPostsRouter.post('/', async (c) => {
  const bodyResult = await parseBodyResult(c);
  const bv = validateBody(c, createPostSchema, bodyResult);
  if (!bv.ok) return bv.response;

  try {
    const post = await createPostService(bv.data);
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
  const bv = validateBody(c, updatePostSchema, bodyResult);
  if (!bv.ok) return bv.response;

  try {
    const updated = await updatePostService(id, bv.data);
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
