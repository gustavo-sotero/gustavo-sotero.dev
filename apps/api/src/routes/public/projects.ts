/**
 * Public routes for projects (authenticated reads not required).
 *
 * Routes:
 *  GET /projects         - Paginated list of published projects (tag/featured filters)
 *  GET /projects/:slug   - Project detail with tags
 */

import { projectQuerySchema } from '@portfolio/shared/schemas/projects';
import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { getProjectBySlug, listProjects } from '../../services/projects.service';
import type { AppEnv } from '../../types/index';

const publicProjectsRouter = new Hono<AppEnv>();

/**
 * GET /projects
 * Returns paginated published projects. Supports `?page`, `?perPage`, `?tag`, `?featured`.
 * Results are cached (TTL 5 min).
 */
publicProjectsRouter.get('/', async (c) => {
  const queryParsed = projectQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    featured: c.req.query('featured'),
    featuredFirst: c.req.query('featuredFirst'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listProjects(queryParsed.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /projects/:slug
 * Returns a published project with its pre-rendered HTML content and tags.
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
