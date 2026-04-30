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
import { ConflictError, DomainValidationError } from '../../lib/errors';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateQuery } from '../../lib/validate';
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
  const qv = validateQuery(c, adminEducationQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    status: c.req.query('status'),
  });
  if (!qv.ok) return qv.response;

  const result = await listEducation(qv.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/education
 * Create a new education entry. Returns 201 with the created resource.
 */
adminEducationRouter.post('/', async (c) => {
  const bv = await parseAndValidateBody(c, createEducationSchema);
  if (!bv.ok) return bv.response;

  try {
    const entry = await createEducationService(bv.data);
    return successResponse(c, entry, 201);
  } catch (err) {
    if (err instanceof ConflictError) return errorResponse(c, 409, 'CONFLICT', err.message);
    if (err instanceof DomainValidationError)
      return errorResponse(c, 400, 'VALIDATION_ERROR', err.message, err.details);
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

  const bv = await parseAndValidateBody(c, updateEducationSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await updateEducationService(id, bv.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Education entry not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    if (err instanceof ConflictError) return errorResponse(c, 409, 'CONFLICT', err.message);
    if (err instanceof DomainValidationError)
      return errorResponse(c, 400, 'VALIDATION_ERROR', err.message, err.details);
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
