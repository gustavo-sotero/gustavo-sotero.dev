/**
 * Admin routes for skill catalog management.
 *
 * Routes:
 *  GET    /admin/skills      - List all skills
 *  POST   /admin/skills      - Create a skill
 *  PATCH  /admin/skills/:id  - Update skill fields
 *  DELETE /admin/skills/:id  - Delete skill (hard delete; CASCADE clears pivots)
 *
 * Note: `iconKey` is always auto-assigned by the system (icon resolver).
 * Clients must NOT send `iconKey` in request bodies — it is ignored if present.
 */

import {
  createSkillSchema,
  skillQuerySchema,
  updateSkillSchema,
} from '@portfolio/shared/schemas/skills';
import { Hono } from 'hono';
import { ConflictError, HighlightLimitError } from '../../lib/errors';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateQuery } from '../../lib/validate';
import {
  createSkillService,
  deleteSkillService,
  getSkillById,
  listSkills,
  updateSkillService,
} from '../../services/skills.service';
import type { AppEnv } from '../../types/index';

export const adminSkillsRouter = new Hono<AppEnv>();

/**
 * GET /admin/skills
 * List all skills (admin view).
 */
adminSkillsRouter.get('/', async (c) => {
  const qv = validateQuery(c, skillQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    category: c.req.query('category'),
    highlighted: c.req.query('highlighted'),
  });
  if (!qv.ok) return qv.response;

  const result = await listSkills(qv.data, false);
  return paginatedResponse(c, result.data, result.meta);
});

/**
 * GET /admin/skills/:id
 * Get a single skill by ID.
 */
adminSkillsRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid skill ID');
  }

  const skill = await getSkillById(id);
  if (!skill) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Skill not found');
  }
  return successResponse(c, skill);
});

/**
 * POST /admin/skills
 * Create a new skill. Returns 201 with the created resource.
 */
adminSkillsRouter.post('/', async (c) => {
  const bv = await parseAndValidateBody(c, createSkillSchema);
  if (!bv.ok) return bv.response;

  try {
    const skill = await createSkillService(bv.data);
    return successResponse(c, skill, 201);
  } catch (err) {
    if (err instanceof HighlightLimitError) return errorResponse(c, 409, 'CONFLICT', err.message);
    if (err instanceof ConflictError) return errorResponse(c, 409, 'CONFLICT', err.message);
    throw err;
  }
});

/**
 * PATCH /admin/skills/:id
 * Update skill fields. iconKey is always recalculated server-side.
 */
adminSkillsRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid skill ID');
  }

  const bv = await parseAndValidateBody(c, updateSkillSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await updateSkillService(id, bv.data);
    if (!updated) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Skill not found');
    }
    return successResponse(c, updated);
  } catch (err) {
    if (err instanceof HighlightLimitError) return errorResponse(c, 409, 'CONFLICT', err.message);
    if (err instanceof ConflictError) return errorResponse(c, 409, 'CONFLICT', err.message);
    throw err;
  }
});

/**
 * DELETE /admin/skills/:id
 * Hard-delete a skill. Cascade removes all project_skills and experience_skills rows.
 */
adminSkillsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid skill ID');
  }

  const result = await deleteSkillService(id);
  if (!result) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Skill not found');
  }
  return c.body(null, 204);
});
