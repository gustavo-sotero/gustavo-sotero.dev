/**
 * Public routes for experience (no authentication required).
 *
 * Routes:
 *  GET /experience         - Paginated list of published experience entries
 *  GET /experience/:slug   - Experience entry detail
 */

import { experienceQuerySchema } from '@portfolio/shared/schemas/experience';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { getExperienceBySlug, listExperience } from '../../services/experience.service';
import type { AppEnv } from '../../types/index';

const publicExperienceRouter = new Hono<AppEnv>();

/**
 * GET /experience
 * Returns paginated published experience entries.
 */
publicExperienceRouter.get('/', async (c) => {
  const qv = validateQuery(c, experienceQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
  });
  if (!qv.ok) return qv.response;

  const result = await listExperience(qv.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /experience/:slug
 * Returns a single published experience entry.
 */
publicExperienceRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const entry = await getExperienceBySlug(slug, false);

  if (!entry) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Experience entry not found');
  }

  return successResponse(c, entry);
});

export { publicExperienceRouter };
