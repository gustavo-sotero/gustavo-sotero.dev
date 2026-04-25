/**
 * Public routes for projects (authenticated reads not required).
 *
 * Routes:
 *  GET /projects         - Paginated list of published projects (skill/featured filters)
 *  GET /projects/:slug   - Project detail with skills
 */

import { projectQuerySchema } from '@portfolio/shared/schemas/projects';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { getProjectBySlug, listProjects } from '../../services/projects.service';
import type { AppEnv } from '../../types/index';

const publicProjectsRouter = new Hono<AppEnv>();

/**
 * GET /projects
 * Returns paginated published projects. Supports `?page`, `?perPage`, `?skill`, `?featured`.
 * Results are cached (TTL 5 min).
 */
publicProjectsRouter.get('/', async (c) => {
  const qv = validateQuery(c, projectQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    skill: c.req.query('skill'),
    featured: c.req.query('featured'),
    featuredFirst: c.req.query('featuredFirst'),
  });
  if (!qv.ok) return qv.response;

  const result = await listProjects(qv.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /projects/:slug
 * Returns a published project with its pre-rendered HTML content and skills.
 * Cached for 1 hour.
 */
publicProjectsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const project = await getProjectBySlug(slug, false);

  if (!project) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Project not found');
  }

  return successResponse(c, project);
});

export { publicProjectsRouter };
