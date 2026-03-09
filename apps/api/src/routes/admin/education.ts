/**
 * Admin routes for education management (JWT + CSRF required).
 *
 * Routes:
 *  GET    /admin/education       - List all education entries (all statuses)
 *  POST   /admin/education       - Create an education entry
 *  GET    /admin/education/:slug - Get a single entry by slug
 *  PATCH  /admin/education/:id   - Update an entry by numeric ID
 *  DELETE /admin/education/:id   - Soft-delete an entry by numeric ID
 */

import {
  adminEducationQuerySchema,
  createEducationSchema,
  updateEducationSchema,
} from '@portfolio/shared/schemas/education';
import { Hono } from 'hono';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import {
  createEducationService,
  getEducationBySlug,
  listEducation,
  softDeleteEducationService,
  updateEducationService,
} from '../../services/education.service';
import type { AppEnv } from '../../types/index';

const adminEducationRouter = new Hono<AppEnv>();

/**
 * GET /admin/education
 * List all education entries (including drafts), with optional status filter.
 */
adminEducationRouter.get('/', async (c) => {
  const queryParsed = adminEducationQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    status: c.req.query('status'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listEducation(queryParsed.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/education
 * Create a new education entry. Returns 201 with the created resource.
 */
adminEducationRouter.post('/', async (c) => {
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

  const parsed = createEducationSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const entry = await createEducationService(parsed.data);
    return successResponse(c, entry, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    if (message.startsWith('VALIDATION_ERROR:')) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', message.replace('VALIDATION_ERROR: ', ''));
    }
    throw err;
  }
});

/**
 * GET /admin/education/:slug
 * Get a single education entry by slug (admin — includes drafts).
 */
adminEducationRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const entry = await getEducationBySlug(slug, true);

  if (!entry) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Education entry not found');
  }

  return successResponse(c, entry);
});

/**
 * PATCH /admin/education/:id
 * Update an existing education entry by numeric ID.
 */
adminEducationRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid education ID');
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

  const parsed = updateEducationSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const updated = await updateEducationService(id, parsed.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Education entry not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    if (message.startsWith('VALIDATION_ERROR:')) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', message.replace('VALIDATION_ERROR: ', ''));
    }
    throw err;
  }
});

/**
 * DELETE /admin/education/:id
 * Soft-delete an education entry by numeric ID. Returns 204 No Content.
 */
adminEducationRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid education ID');
  }

  const result = await softDeleteEducationService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Education entry not found');
  }

  return c.body(null, 204);
});

export { adminEducationRouter };
