/**
 * OpenAPI 3.1 specification and Swagger UI.
 *
 * Routes:
 *  GET /doc/spec  - OpenAPI 3.1 JSON specification
 *  GET /doc       - Swagger UI (browser-navigable documentation)
 *
 * The spec is assembled from domain modules under ./openapi/:
 *  - openapi/spec.ts            — root assembler (info, servers, tags)
 *  - openapi/components.ts      — reusable schemas, parameters, responses
 *  - openapi/paths/public-paths.ts — public path definitions
 *  - openapi/paths/admin-paths.ts  — admin path definitions
 */

import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { env } from '../../config/env';
import type { AppEnv } from '../../types/index';
import { OPENAPI_SPEC } from './openapi/spec';

const openApiRouter = new Hono<AppEnv>();

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /doc/spec
 * Returns the OpenAPI 3.1 specification as JSON.
 */
openApiRouter.get('/doc/spec', (c) => {
  c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return c.json(OPENAPI_SPEC);
});

/**
 * GET /doc
 * Swagger UI — interactive API documentation.
 * Points to /doc/spec for the OpenAPI specification.
 */
openApiRouter.get(
  '/doc',
  swaggerUI({
    // Use the public API base so Swagger keeps working when the app is exposed
    // behind a proxy path prefix such as https://site.com/api.
    url: `${env.API_PUBLIC_URL}/doc/spec`,
    title: 'Portfolio API — Documentation',
  })
);

export { openApiRouter };
