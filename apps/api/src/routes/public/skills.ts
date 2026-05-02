import { skillQuerySchema } from '@portfolio/shared/schemas/skills';
import { Hono } from 'hono';
import { windowedResponse } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { listSkills } from '../../services/skills.service';
import type { AppEnv } from '../../types/index';

export const publicSkillsRouter = new Hono<AppEnv>();

/**
 * GET /skills
 *
 * Returns the public skill catalog, sorted by category and name.
 * Highlighted skills appear first within each group.
 *
 * Supports optional filters: category (comma-separated), highlighted (boolean).
 */
publicSkillsRouter.get('/', async (c) => {
  const qv = validateQuery(c, skillQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    category: c.req.query('category'),
    highlighted: c.req.query('highlighted'),
  });
  if (!qv.ok) return qv.response;

  const result = await listSkills(
    {
      category: qv.data.category,
      highlighted: qv.data.highlighted,
      page: qv.data.page,
      perPage: qv.data.perPage,
    },
    true, // use public cache
    { includeTotal: false }
  );
  return windowedResponse(c, result.data, result.meta);
});
