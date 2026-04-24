/**
 * Admin routes for tags management.
 *
 * Routes:
 *  GET    /admin/tags      - List all tags
 *  POST   /admin/tags      - Create a tag
 *  PATCH  /admin/tags/:id  - Update tag (name, category)
 *  DELETE /admin/tags/:id  - Delete tag (hard delete; CASCADE clears pivots)
 *
 * Note: `iconKey` is always auto-assigned by the system (icon resolver).
 * Clients must NOT send `iconKey` in request bodies — it is ignored if present.
 */

import {
  createTagSchema,
  resolveAiTagsSchema,
  tagQuerySchema,
  updateTagSchema,
} from '@portfolio/shared/schemas/tags';
import { Hono } from 'hono';
import { errorResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateQuery } from '../../lib/validate';
import {
  createTagService,
  deleteTagService,
  listTags,
  resolveAiSuggestedTags,
  updateTagService,
} from '../../services/tags.service';
import type { AppEnv } from '../../types/index';

const adminTagsRouter = new Hono<AppEnv>();

/**
 * GET /admin/tags
 * List all tags (admin view — not restricted to tags in use).
 */
adminTagsRouter.get('/', async (c) => {
  const qv = validateQuery(c, tagQuerySchema, {
    category: c.req.query('category'),
  });
  if (!qv.ok) return qv.response;

  const result = await listTags(qv.data, false);
  return successResponse(c, result.data);
});

/**
 * POST /admin/tags
 * Create a new tag. Returns 201 with the created resource.
 */
adminTagsRouter.post('/', async (c) => {
  const bv = await parseAndValidateBody(c, createTagSchema);
  if (!bv.ok) return bv.response;

  try {
    const tag = await createTagService(bv.data);
    return successResponse(c, tag, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.toLowerCase().includes('conflict') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', 'A tag with this name already exists');
    }
    throw err;
  }
});

/**
 * POST /admin/tags/resolve-ai-suggested
 * Resolve a list of AI-suggested tag names to persisted tag IDs.
 * Missing tags are auto-created with category inferred from the shared catalog.
 * Only the admin flow (draft acceptance) should call this endpoint.
 */
adminTagsRouter.post('/resolve-ai-suggested', async (c) => {
  const bv = await parseAndValidateBody(c, resolveAiTagsSchema);
  if (!bv.ok) return bv.response;

  const resolvedTags = await resolveAiSuggestedTags(bv.data.names);
  return successResponse(c, resolvedTags, 200);
});

/**
 * PATCH /admin/tags/:id
 * Update tag name or category.
 * iconKey is always recalculated server-side from final name + category — not accepted from client.
 */
adminTagsRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid tag ID');
  }

  const bv = await parseAndValidateBody(c, updateTagSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await updateTagService(id, bv.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Tag not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.toLowerCase().includes('conflict') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', 'A tag with this name already exists');
    }
    throw err;
  }
});

/**
 * DELETE /admin/tags/:id
 * Hard-delete a tag. FK CASCADE removes pivot rows automatically.
 * Returns 204 No Content.
 */
adminTagsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid tag ID');
  }

  const result = await deleteTagService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Tag not found');
  }

  return c.body(null, 204);
});

export { adminTagsRouter };
