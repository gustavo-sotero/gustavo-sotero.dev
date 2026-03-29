/**
 * Admin routes for experience management (JWT + CSRF required).
 *
 * Routes:
 *  GET    /admin/experience       - List all experience entries (all statuses)
 *  POST   /admin/experience       - Create an experience entry
 *  GET    /admin/experience/:slug - Get a single entry by slug
 *  PATCH  /admin/experience/:id   - Update an entry by numeric ID
 *  DELETE /admin/experience/:id   - Soft-delete an entry by numeric ID
 */

import {
  adminExperienceQuerySchema,
  createExperienceSchema,
  updateExperienceSchema,
} from '@portfolio/shared/schemas/experience';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateQuery } from '../../lib/validate';
import {
  createExperienceService,
  getExperienceBySlug,
  listExperience,
  softDeleteExperienceService,
  updateExperienceService,
} from '../../services/experience.service';
import type { AppEnv } from '../../types/index';

const adminExperienceRouter = new Hono<AppEnv>();

/**
 * GET /admin/experience
 * List all experience entries (including drafts), with optional status filter.
 */
adminExperienceRouter.get('/', async (c) => {
  const qv = validateQuery(c, adminExperienceQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    status: c.req.query('status'),
  });
  if (!qv.ok) return qv.response;

  const result = await listExperience(qv.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/experience
 * Create a new experience entry. Returns 201 with the created resource.
 */
adminExperienceRouter.post('/', async (c) => {
  const bv = await parseAndValidateBody(c, createExperienceSchema);
  if (!bv.ok) return bv.response;

  try {
    const entry = await createExperienceService(bv.data);
    return successResponse(c, entry, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    if (message.startsWith('VALIDATION_ERROR:')) {
      const details = (err as { invalidTagIds?: number[] }).invalidTagIds?.map((id) => ({
        field: 'tagIds',
        message: `Tag with id ${id} does not exist`,
      }));
      return errorResponse(
        c,
        400,
        'VALIDATION_ERROR',
        message.replace('VALIDATION_ERROR: ', ''),
        details
      );
    }
    throw err;
  }
});

/**
 * GET /admin/experience/:slug
 * Get a single experience entry by slug (admin — includes drafts).
 */
adminExperienceRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const entry = await getExperienceBySlug(slug, true);

  if (!entry) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Experience entry not found');
  }

  return successResponse(c, entry);
});

/**
 * PATCH /admin/experience/:id
 * Update an existing experience entry by numeric ID.
 */
adminExperienceRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid experience ID');
  }

  const bv = await parseAndValidateBody(c, updateExperienceSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await updateExperienceService(id, bv.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Experience entry not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    if (message.startsWith('VALIDATION_ERROR:')) {
      const details = (err as { invalidTagIds?: number[] }).invalidTagIds?.map((id) => ({
        field: 'tagIds',
        message: `Tag with id ${id} does not exist`,
      }));
      return errorResponse(
        c,
        400,
        'VALIDATION_ERROR',
        message.replace('VALIDATION_ERROR: ', ''),
        details
      );
    }
    throw err;
  }
});

/**
 * DELETE /admin/experience/:id
 * Soft-delete an experience entry by numeric ID. Returns 204 No Content.
 */
adminExperienceRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid experience ID');
  }

  const result = await softDeleteExperienceService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Experience entry not found');
  }

  return c.body(null, 204);
});

export { adminExperienceRouter };
