/**
 * Assembled OpenAPI 3.1 specification.
 *
 * Domain modules:
 *  - components.ts   — reusable schemas, parameters, responses, securitySchemes
 *  - public-paths.ts — all public (unauthenticated) path definitions
 *  - admin-paths.ts  — all admin (JWT-required) path definitions
 */

import { env } from '../../../config/env';
import { openApiComponents } from './components';
import { adminPaths } from './paths/admin-paths';
import { publicPaths } from './paths/public-paths';

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Portfolio API',
    version: '1.0.0',
    description:
      'Personal portfolio REST API — technical proof of concept.\n\n' +
      'Demonstrates: Hono + Bun + Drizzle ORM + PostgreSQL + BullMQ + Redis.\n\n' +
      '**Standard response format:**\n\n' +
      '```json\n{ "success": true, "data": { ... } }\n```\n\n' +
      'Paginated responses include a `meta` object with `page`, `perPage`, `total`, `totalPages`.',
    contact: {
      name: 'Portfolio Author',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '{apiUrl}',
      description: 'API Server',
      variables: {
        apiUrl: {
          default: env.API_PUBLIC_URL,
          description: 'Base URL of the API (e.g. https://yoursite.com/api in production)',
        },
      },
    },
  ],
  tags: [
    { name: 'Documentation', description: 'OpenAPI specification and Swagger UI' },
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Posts', description: 'Public blog post endpoints' },
    { name: 'Projects', description: 'Public portfolio project endpoints' },
    { name: 'Skills', description: 'Public skill catalog for stack and resume surfaces' },
    { name: 'Tags', description: 'Content taxonomy and public filter chips' },
    { name: 'Comments', description: 'Anonymous comment submission' },
    { name: 'Contact', description: 'Contact form submission' },
    { name: 'Feed', description: 'RSS and sitemap syndication' },
    { name: 'Auth', description: 'GitHub OAuth authentication' },
    { name: 'Admin - Posts', description: 'Admin post management (JWT required)' },
    { name: 'Admin - Projects', description: 'Admin project management (JWT required)' },
    { name: 'Admin - Skills', description: 'Admin skill catalog management (JWT required)' },
    { name: 'Admin - Tags', description: 'Admin tag management (JWT required)' },
    { name: 'Admin - Comments', description: 'Comment moderation (JWT required)' },
    { name: 'Admin - Contacts', description: 'Contact message management (JWT required)' },
    { name: 'Admin - Uploads', description: 'Image upload pipeline (JWT required)' },
    { name: 'Admin - Analytics', description: 'Pageview analytics (JWT required)' },
    { name: 'Admin - Jobs', description: 'Background job monitoring (JWT required)' },
    { name: 'Experience', description: 'Professional experience timeline' },
    { name: 'Education', description: 'Educational background and courses' },
    { name: 'Admin - Experience', description: 'Admin experience management (JWT required)' },
    { name: 'Admin - Education', description: 'Admin education management (JWT required)' },
    { name: 'Developer', description: 'Aggregated developer profile for public consumption' },
  ],
  components: openApiComponents,
  paths: { ...publicPaths, ...adminPaths },
} as const;
