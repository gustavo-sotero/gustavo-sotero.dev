/**
 * Public route: Developer Profile.
 *
 * Exposes a single, aggregated endpoint that returns a complete technical
 * profile of the developer. Designed for human-readable consumption (Swagger,
 * terminal curl) and machine consumption by the frontend Hero component.
 *
 * Route:
 *  GET /developer/profile  - Complete, aggregated developer profile
 *
 * Pretty-print is applied locally on this endpoint only. All other routes
 * continue to serve compact JSON for performance.
 */

import { Hono } from 'hono';
import { getDeveloperProfile } from '../../services/developer-profile.service';
import type { AppEnv } from '../../types/index';

const publicDeveloperRouter = new Hono<AppEnv>();

/**
 * GET /developer/profile
 *
 * Returns the complete developer profile with:
 *  - Personal information (name, role, bio, location, availability, links)
 *  - Technology stack grouped by category
 *  - Professional experience timeline
 *  - Educational background
 *  - Recent/featured projects (up to 5)
 *  - Recent published posts (up to 5)
 *  - Public aggregate metrics (post/project/skill counts, pageviews 30d)
 *
 * Response is always pretty-printed JSON for enhanced readability.
 */
publicDeveloperRouter.get('/profile', async (c) => {
  const data = await getDeveloperProfile();
  const payload = { success: true, data };

  return c.body(JSON.stringify(payload, null, 2), 200, {
    'Content-Type': 'application/json; charset=utf-8',
  });
});

export { publicDeveloperRouter };
