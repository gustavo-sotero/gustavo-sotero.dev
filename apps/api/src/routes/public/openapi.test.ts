import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { env } from '../../config/env';
import { openApiRouter } from './openapi';

describe('openapi routes', () => {
  it('GET /doc/spec returns OpenAPI 3.1 JSON with cache header', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Portfolio API');
    expect(body.paths).toHaveProperty('/posts');
    expect(body.paths).toHaveProperty('/projects');
    expect(body.paths).toHaveProperty('/auth/github/start');
  });

  it('GET /doc returns Swagger UI HTML', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain(`${env.API_PUBLIC_URL}/doc/spec`);
  });

  it('GET /doc/spec exposes the path-based API server as the default server URL', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      servers: Array<{
        variables?: {
          apiUrl?: {
            default?: string;
          };
        };
      }>;
    };

    expect(body.servers[0]?.variables?.apiUrl?.default).toBe(env.API_PUBLIC_URL);
  });

  it('GET /doc/spec includes all Module 8 route contracts', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<string, unknown>;
    };

    const expectedPaths = [
      '/health',
      '/ready',
      '/posts',
      '/posts/{slug}',
      '/projects',
      '/projects/{slug}',
      '/comments',
      '/contact',
      '/tags',
      '/feed.xml',
      '/sitemap.xml',
      '/doc/spec',
      '/doc',
      '/auth/github/start',
      '/auth/github/callback',
      '/auth/logout',
      '/admin/posts',
      '/admin/posts/{id}',
      '/admin/posts/generate/config',
      '/admin/posts/generate/models',
      '/admin/posts/generate/topics',
      '/admin/posts/generate/draft',
      '/admin/projects',
      '/admin/projects/{id}',
      '/admin/tags',
      '/admin/tags/{id}',
      '/admin/comments',
      '/admin/comments/reply',
      '/admin/comments/{id}/approve',
      '/admin/comments/{id}/reject',
      '/admin/comments/{id}/status',
      '/admin/comments/{id}/content',
      '/admin/comments/{id}',
      '/admin/contacts',
      '/admin/contacts/{id}/read',
      '/admin/uploads/presign',
      '/admin/uploads/{id}/confirm',
      '/admin/uploads/{id}',
      '/admin/analytics/summary',
      '/admin/analytics/top-posts',
      '/experience',
      '/experience/{slug}',
      '/education',
      '/education/{slug}',
      '/admin/experience',
      '/admin/experience/{identifier}',
      '/admin/education',
      '/admin/education/{id}',
      '/admin/jobs/dlq',
      '/developer/profile',
    ];

    for (const path of expectedPaths) {
      expect(Object.hasOwn(body.paths, path)).toBe(true);
    }
  });

  it('GET /doc/spec documents /tags source filter and default union semantics', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          get?: {
            description?: string;
            parameters?: Array<{
              name?: string;
              in?: string;
              schema?: { enum?: string[] };
            }>;
          };
        }
      >;
    };

    const tagsGet = body.paths['/tags']?.get;
    const sourceParam = tagsGet?.parameters?.find(
      (param) => param.name === 'source' && param.in === 'query'
    );

    expect(sourceParam?.schema?.enum).toEqual(['project', 'post', 'experience']);
    expect(tagsGet?.description).toContain(
      'When `source` is omitted, the union of all origins is returned'
    );
  });

  it('GET /doc/spec documents admin project and experience write contracts truthfully', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          get?: {
            summary?: string;
            description?: string;
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    example?: {
                      success?: boolean;
                      data?: Record<string, string>;
                    };
                  };
                };
              }
            >;
          };
          post?: {
            responses?: Record<string, unknown>;
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: {
                    properties?: Record<string, { default?: boolean; uniqueItems?: boolean }>;
                  };
                };
              };
            };
          };
          patch?: {
            responses?: Record<string, unknown>;
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: {
                    properties?: Record<string, { uniqueItems?: boolean }>;
                  };
                };
              };
            };
          };
        }
      >;
    };

    const projectCreate =
      body.paths['/admin/projects']?.post?.requestBody?.content?.['application/json']?.schema;
    const postCreate = body.paths['/admin/posts']?.post;
    const experiencePath = body.paths['/admin/experience/{identifier}'];
    const readyPath = body.paths['/ready']?.get;

    expect(projectCreate?.properties?.tagIds?.uniqueItems).toBe(true);
    expect(projectCreate?.properties?.featured?.default).toBe(false);
    expect(postCreate?.responses && Object.hasOwn(postCreate.responses, '409')).toBe(true);
    expect(experiencePath?.get?.summary).toBe('Get experience entry by slug (admin)');
    expect(
      experiencePath?.patch?.requestBody?.content?.['application/json']?.schema?.properties?.tagIds
        ?.uniqueItems
    ).toBe(true);
    expect(
      experiencePath?.patch?.responses && Object.hasOwn(experiencePath.patch.responses, '409')
    ).toBe(true);
    expect(readyPath?.description).toBe(
      'Checks database connectivity, Redis connectivity, and required schema parity.'
    );
    expect(readyPath?.responses?.['200']?.content?.['application/json']?.example?.data).toEqual({
      db: 'ok',
      redis: 'ok',
      schema: 'ok',
    });
  });

  it('GET /doc/spec documents AI post generation contracts with concrete examples', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          post?: {
            description?: string;
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: {
                    properties?: Record<
                      string,
                      {
                        enum?: string[];
                        default?: number | unknown[];
                        minimum?: number;
                        maximum?: number;
                        maxItems?: number;
                        nullable?: boolean;
                        required?: string[];
                        properties?: Record<string, { maxItems?: number }>;
                      }
                    >;
                    required?: string[];
                  };
                  example?: Record<string, unknown>;
                };
              };
            };
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    example?: {
                      success?: boolean;
                      data?: Record<string, unknown>;
                    };
                  };
                };
              }
            >;
          };
          get?: {
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    examples?: Record<
                      string,
                      { value?: { success?: boolean; data?: Record<string, unknown> } }
                    >;
                  };
                };
              }
            >;
          };
        }
      >;
    };

    const topicsPost = body.paths['/admin/posts/generate/topics']?.post;
    const draftPost = body.paths['/admin/posts/generate/draft']?.post;
    const draftRunsPost = body.paths['/admin/posts/generate/draft-runs']?.post;
    const draftRunStatusGet = body.paths['/admin/posts/generate/draft-runs/{id}']?.get;
    const topicsSchema = topicsPost?.requestBody?.content?.['application/json']?.schema;
    const draftSchema = draftPost?.requestBody?.content?.['application/json']?.schema;
    const draftRunsSchema = draftRunsPost?.requestBody?.content?.['application/json']?.schema;
    const topicsSuccess = topicsPost?.responses?.['200']?.content?.['application/json']?.example;
    const draftSuccess = draftPost?.responses?.['200']?.content?.['application/json']?.example;
    const draftRunsAccepted =
      draftRunsPost?.responses?.['202']?.content?.['application/json']?.example;
    const draftRunCompleted =
      draftRunStatusGet?.responses?.['200']?.content?.['application/json']?.examples?.completed
        ?.value;
    const draftRunCompletedResult = draftRunCompleted?.data?.result as
      | Record<string, unknown>
      | undefined;

    expect(topicsPost?.description).toContain('ephemeral');
    expect(topicsSchema?.properties?.category?.enum).toContain('backend-arquitetura');
    expect(topicsSchema?.properties?.limit?.default).toBe(4);
    expect(topicsSchema?.properties?.limit?.minimum).toBe(3);
    expect(topicsSchema?.properties?.limit?.maximum).toBe(5);
    expect(topicsSchema?.properties?.briefing?.nullable).toBe(true);
    expect(topicsSchema?.properties?.excludedIdeas?.maxItems).toBe(10);
    expect(Array.isArray(topicsSuccess?.data?.suggestions)).toBe(true);
    expect((topicsSuccess?.data?.suggestions as unknown[]).length).toBeGreaterThanOrEqual(3);

    // Legacy sync draft endpoint — description should reference the async runs route
    expect(draftPost?.description).toContain('draft-runs');
    expect(draftSchema?.required).toContain('selectedSuggestion');
    expect(
      draftSchema?.properties?.selectedSuggestion?.properties?.suggestedTagNames?.maxItems
    ).toBe(6);
    expect(Array.isArray(draftSuccess?.data?.suggestedTagNames)).toBe(true);
    expect(typeof draftSuccess?.data?.imagePrompt).toBe('string');
    expect(String(draftSuccess?.data?.imagePrompt)).toMatch(/ilustra|minimalista|thumb|1:1|4:3/i);
    expect(typeof draftSuccess?.data?.content).toBe('string');
    expect(typeof draftSuccess?.data?.linkedinPost).toBe('string');
    expect(String(draftSuccess?.data?.linkedinPost)).toContain('https://gustavo-sotero.dev/blog/');
    expect(String(draftSuccess?.data?.linkedinPost)).toMatch(/#\w+/);

    expect(draftRunsPost?.description).toContain('run ID');
    expect(draftRunsSchema?.properties?.category?.enum).toContain('misto');
    expect(draftRunsSchema?.required).toContain('selectedSuggestion');
    expect(draftRunsSchema?.properties?.selectedSuggestion?.required).toContain('proposedTitle');
    expect(draftRunsSchema?.properties?.selectedSuggestion?.required).toContain(
      'suggestedTagNames'
    );
    expect(
      draftRunsSchema?.properties?.selectedSuggestion?.properties?.suggestedTagNames?.maxItems
    ).toBe(6);
    expect(draftRunsAccepted?.data?.status).toBe('queued');
    expect(draftRunsAccepted?.data?.stage).toBe('queued');
    expect(draftRunCompleted?.data?.selectedSuggestionCategory).toBe('dados-filas-consistencia');
    expect(Array.isArray(draftRunCompletedResult?.suggestedTagNames)).toBe(true);
    expect(typeof draftRunCompletedResult?.imagePrompt).toBe('string');
    expect(String(draftRunCompletedResult?.imagePrompt)).toMatch(
      /ilustra|minimalista|thumb|1:1|4:3/i
    );
    expect(typeof draftRunCompletedResult?.linkedinPost).toBe('string');
    expect(String(draftRunCompletedResult?.linkedinPost)).toContain(
      'https://gustavo-sotero.dev/blog/'
    );
    expect(String(draftRunCompletedResult?.linkedinPost)).toMatch(/#\w+/);
  });
});
