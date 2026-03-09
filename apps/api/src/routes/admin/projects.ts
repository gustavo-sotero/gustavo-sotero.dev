/**
 * Admin routes for projects management (all statuses, soft delete).
 *
 * Routes:
 *  GET    /admin/projects          - List projects (all statuses)
 *  POST   /admin/projects          - Create a project
 *  GET    /admin/projects/:slug    - Get a single project by slug
 *  PATCH  /admin/projects/:id      - Update a project
 *  DELETE /admin/projects/:id      - Soft-delete a project
 */

import {
  adminProjectQuerySchema,
  createProjectSchema,
  updateProjectSchema,
} from '@portfolio/shared/schemas/projects';
import { Hono } from 'hono';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import {
  createProjectService,
  getProjectBySlug,
  listProjects,
  softDeleteProjectService,
  updateProjectService,
} from '../../services/projects.service';
import type { AppEnv } from '../../types/index';

const adminProjectsRouter = new Hono<AppEnv>();

/**
 * GET /admin/projects
 * List all projects (including drafts) with optional filters and pagination.
 */
adminProjectsRouter.get('/', async (c) => {
  const queryParsed = adminProjectQuerySchema.safeParse({
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    tag: c.req.query('tag'),
    status: c.req.query('status'),
    featured: c.req.query('featured'),
  });

  if (!queryParsed.success) {
    const details = queryParsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
  }

  const result = await listProjects(queryParsed.data, true);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * POST /admin/projects
 * Create a new project. Returns 201 with the created resource.
 */
adminProjectsRouter.post('/', async (c) => {
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

  const parsed = createProjectSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const project = await createProjectService(parsed.data);
    return successResponse(c, project, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('CONFLICT:') || message.toLowerCase().includes('unique')) {
      return errorResponse(c, 409, 'CONFLICT', message.replace('CONFLICT: ', ''));
    }
    throw err;
  }
});

/**
 * GET /admin/projects/:slug
 * Get a single project by slug (admin — includes drafts).
 */
adminProjectsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const project = await getProjectBySlug(slug, true);

  if (!project) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Project not found');
  }

  return successResponse(c, project);
});

/**
 * PATCH /admin/projects/:id
 * Update an existing project by numeric ID.
 */
adminProjectsRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid project ID');
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

  const parsed = updateProjectSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const updated = await updateProjectService(id, parsed.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Project not found');
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
 * DELETE /admin/projects/:id
 * Soft-delete a project by numeric ID. Returns 204 No Content.
 */
adminProjectsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid project ID');
  }

  const result = await softDeleteProjectService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Project not found');
  }

  return c.body(null, 204);
});

export { adminProjectsRouter };
