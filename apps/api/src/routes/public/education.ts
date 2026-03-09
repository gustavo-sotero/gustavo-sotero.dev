/**
 * Public routes for education (no authentication required).
 *
 * Routes:
 *  GET /education         - Paginated list of published education entries
 *  GET /education/:slug   - Education entry detail
 */

import { educationQuerySchema } from '@portfolio/shared/schemas/education';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { getEducationBySlug, listEducation } from '../../services/education.service';
import type { AppEnv } from '../../types/index';

const publicEducationRouter = new Hono<AppEnv>();

/**
 * GET /education
 * Returns paginated published education entries.
 */
publicEducationRouter.get('/', async (c) => {
  const queryParsed = educationQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listEducation(queryParsed.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /education/:slug
 * Returns a single published education entry.
 */
publicEducationRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const entry = await getEducationBySlug(slug, false);

  if (!entry) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Education entry not found');
  }

  return successResponse(c, entry);
});

export { publicEducationRouter };
