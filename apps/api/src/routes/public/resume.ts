/**
 * Resume aggregate endpoint.
 *
 * Returns all resume sections in a single round-trip, replacing the 4-request
 * fan-out previously made by the web SSR layer.
 *
 * Routes:
 *  GET /resume   - Full resume aggregate (profile, experience, education,
 *                  skills, projects)
 */

import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { getResumeAggregate } from '../../services/resume.service';
import type { AppEnv } from '../../types/index';

const publicResumeRouter = new Hono<AppEnv>();

/**
 * GET /resume
 *
 * Returns the complete resume payload in one response.
 * Cached at the service layer — no COUNT queries are executed.
 */
publicResumeRouter.get('/', async (c) => {
  const data = await getResumeAggregate();
  return successResponse(c, data);
});

export { publicResumeRouter };
