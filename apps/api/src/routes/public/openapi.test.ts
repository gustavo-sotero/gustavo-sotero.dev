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
    expect(body.paths).toHaveProperty('/skills');
    expect(body.paths).toHaveProperty('/admin/skills');
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
      '/admin/tags/resolve-ai-suggested',
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

  it('GET /doc/spec documents the AI suggested tag resolution endpoint contract', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          post?: {
            operationId?: string;
            description?: string;
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: {
                    required?: string[];
                    properties?: Record<
                      string,
                      {
                        minItems?: number;
                        maxItems?: number;
                        example?: string[];
                      }
                    >;
                  };
                };
              };
            };
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    example?: {
                      data?: Array<{ name?: string; category?: string }>;
                    };
                  };
                };
              }
            >;
          };
        }
      >;
    };

    const resolvePost = body.paths['/admin/tags/resolve-ai-suggested']?.post;
    const namesSchema =
      resolvePost?.requestBody?.content?.['application/json']?.schema?.properties?.names;
    const successExample =
      resolvePost?.responses?.['200']?.content?.['application/json']?.example?.data;

    expect(resolvePost?.operationId).toBe('adminResolveAiSuggestedTags');
    expect(resolvePost?.description).toContain(
      'Only call this endpoint when the admin explicitly accepts a draft'
    );
    expect(resolvePost?.requestBody?.content?.['application/json']?.schema?.required).toContain(
      'names'
    );
    expect(namesSchema?.minItems).toBe(1);
    expect(namesSchema?.maxItems).toBe(50);
    expect(namesSchema?.example).toEqual(['Redis', 'BullMQ', 'typescript']);
    expect(successExample?.[0]).toMatchObject({ name: 'Redis', category: 'db' });
  });

  it('GET /doc/spec keeps tag contracts taxonomy-only and skill contracts highlight-aware', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      components: {
        schemas: Record<string, { properties?: Record<string, unknown> }>;
      };
      paths: Record<
        string,
        {
          post?: {
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: { properties?: Record<string, unknown> };
                };
              };
            };
          };
          patch?: {
            requestBody?: {
              content?: {
                'application/json'?: {
                  schema?: { properties?: Record<string, unknown> };
                };
              };
            };
          };
        }
      >;
    };

    const tagSchema = body.components.schemas.Tag;
    const skillSchema = body.components.schemas.Skill;
    const createTagProps =
      body.paths['/admin/tags']?.post?.requestBody?.content?.['application/json']?.schema
        ?.properties ?? {};
    const updateTagProps =
      body.paths['/admin/tags/{id}']?.patch?.requestBody?.content?.['application/json']?.schema
        ?.properties ?? {};

    expect(tagSchema?.properties).not.toHaveProperty('isHighlighted');
    expect(skillSchema?.properties).toHaveProperty('isHighlighted');
    expect(createTagProps).not.toHaveProperty('isHighlighted');
    expect(updateTagProps).not.toHaveProperty('isHighlighted');
  });

  it('GET /doc/spec documents project and experience skill relations on public schemas', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      components: {
        schemas: Record<string, { properties?: Record<string, unknown> }>;
      };
    };

    const projectSchema = body.components.schemas.Project;
    const experienceSchema = body.components.schemas.Experience;

    expect(projectSchema?.properties).toHaveProperty('tags');
    expect(projectSchema?.properties).toHaveProperty('skills');
    expect(experienceSchema?.properties).toHaveProperty('tags');
    expect(experienceSchema?.properties).toHaveProperty('skills');
  });

  it('GET /doc/spec keeps the developer profile stack example aligned with the Skill contract', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          get?: {
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    example?: {
                      data?: {
                        stack?: {
                          groups?: Record<string, Array<Record<string, unknown>>>;
                        };
                      };
                    };
                  };
                };
              }
            >;
          };
        }
      >;
    };

    const groups =
      body.paths['/developer/profile']?.get?.responses?.['200']?.content?.['application/json']
        ?.example?.data?.stack?.groups ?? {};

    expect(Object.keys(groups).sort()).toEqual([
      'cloud',
      'db',
      'framework',
      'infra',
      'language',
      'tool',
    ]);

    for (const sample of [groups.language?.[0], groups.framework?.[0], groups.db?.[0]]) {
      expect(sample).toMatchObject({
        expertiseLevel: expect.any(Number),
        isHighlighted: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    }
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
                    properties?: Record<
                      string,
                      { default?: boolean; uniqueItems?: boolean; maxItems?: number }
                    >;
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
                    properties?: Record<string, { uniqueItems?: boolean; maxItems?: number }>;
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
    const postCreateProps =
      body.paths['/admin/posts']?.post?.requestBody?.content?.['application/json']?.schema
        ?.properties ?? {};
    const experienceCreate =
      body.paths['/admin/experience']?.post?.requestBody?.content?.['application/json']?.schema;
    const experiencePath = body.paths['/admin/experience/{identifier}'];
    const readyPath = body.paths['/ready']?.get;

    expect(projectCreate?.properties?.tagIds?.uniqueItems).toBe(true);
    expect(projectCreate?.properties?.skillIds?.uniqueItems).toBe(true);
    expect(projectCreate?.properties?.featured?.default).toBe(false);
    expect(projectCreate?.properties?.impactFacts?.maxItems).toBe(6);
    expect(postCreate?.responses && Object.hasOwn(postCreate.responses, '409')).toBe(true);
    expect(postCreateProps).not.toHaveProperty('skillIds');
    expect(experienceCreate?.properties?.impactFacts?.maxItems).toBe(6);
    expect(experienceCreate?.properties?.skillIds?.uniqueItems).toBe(true);
    expect(experiencePath?.get?.summary).toBe('Get experience entry by slug (admin)');
    expect(
      experiencePath?.patch?.requestBody?.content?.['application/json']?.schema?.properties?.tagIds
        ?.uniqueItems
    ).toBe(true);
    expect(
      experiencePath?.patch?.requestBody?.content?.['application/json']?.schema?.properties
        ?.skillIds?.uniqueItems
    ).toBe(true);
    expect(
      experiencePath?.patch?.requestBody?.content?.['application/json']?.schema?.properties
        ?.impactFacts?.maxItems
    ).toBe(6);
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

  it('GET /doc/spec documents impactFacts on developer profile experience and projects', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<
        string,
        {
          get?: {
            responses?: Record<
              string,
              {
                content?: {
                  'application/json'?: {
                    schema?: {
                      properties?: {
                        data?: {
                          properties?: {
                            experience?: {
                              items?: {
                                properties?: Record<string, unknown>;
                              };
                            };
                            projects?: {
                              items?: {
                                properties?: Record<string, unknown>;
                              };
                            };
                          };
                        };
                      };
                    };
                    example?: {
                      data?: {
                        experience?: Array<Record<string, unknown>>;
                        projects?: Array<Record<string, unknown>>;
                      };
                    };
                  };
                };
              }
            >;
          };
        }
      >;
    };

    const profileGet = body.paths['/developer/profile']?.get;
    const json = profileGet?.responses?.['200']?.content?.['application/json'];
    const experienceProps =
      json?.schema?.properties?.data?.properties?.experience?.items?.properties;
    const projectProps = json?.schema?.properties?.data?.properties?.projects?.items?.properties;

    expect(experienceProps && Object.hasOwn(experienceProps, 'impactFacts')).toBe(true);
    expect(projectProps && Object.hasOwn(projectProps, 'impactFacts')).toBe(true);
    expect(Array.isArray(json?.example?.data?.experience?.[0]?.impactFacts)).toBe(true);
    expect(Array.isArray(json?.example?.data?.projects?.[0]?.impactFacts)).toBe(true);
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
    const topicRunsPost = body.paths['/admin/posts/generate/topic-runs']?.post;
    const topicRunStatusGet = body.paths['/admin/posts/generate/topic-runs/{id}']?.get;
    const topicsSchema = topicsPost?.requestBody?.content?.['application/json']?.schema;
    const draftSchema = draftPost?.requestBody?.content?.['application/json']?.schema;
    const draftRunsSchema = draftRunsPost?.requestBody?.content?.['application/json']?.schema;
    const topicRunsSchema = topicRunsPost?.requestBody?.content?.['application/json']?.schema;
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
    const topicRunsAccepted =
      topicRunsPost?.responses?.['202']?.content?.['application/json']?.example;
    const topicRunCompleted =
      topicRunStatusGet?.responses?.['200']?.content?.['application/json']?.examples?.completed
        ?.value;
    const topicRunCompletedResult = topicRunCompleted?.data?.result as
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
    expect(draftRunsPost?.responses && Object.hasOwn(draftRunsPost.responses, '503')).toBe(true);
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

    // ── topic-runs OpenAPI parity ──────────────────────────────────────────────
    expect(topicRunsPost?.description).toContain('topic-runs');
    expect(topicRunsPost?.description).toContain('10 requests per minute');
    expect(topicRunsPost?.responses && Object.hasOwn(topicRunsPost.responses, '503')).toBe(true);
    expect(topicRunsPost?.responses && Object.hasOwn(topicRunsPost.responses, '422')).toBe(false);
    expect(topicRunsSchema?.properties?.category?.enum).toContain('backend-arquitetura');
    expect(topicRunsSchema?.properties?.limit?.default).toBe(4);
    expect(topicRunsSchema?.properties?.limit?.minimum).toBe(3);
    expect(topicRunsSchema?.properties?.limit?.maximum).toBe(5);
    expect(topicRunsSchema?.properties?.excludedIdeas?.maxItems).toBe(10);
    expect(topicRunsAccepted?.data?.status).toBe('queued');
    expect(typeof topicRunsAccepted?.data?.runId).toBe('string');
    expect(topicRunCompleted?.data?.status).toBe('completed');
    expect(topicRunCompleted?.data?.requestedCategory).toBe('backend-arquitetura');
    expect(Array.isArray(topicRunCompletedResult?.suggestions)).toBe(true);
    expect((topicRunCompletedResult?.suggestions as unknown[])?.[0]).toHaveProperty(
      'proposedTitle'
    );
  });

  it('GET /doc/spec documents AI config routing preferences in GET and PUT payloads', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const configPath = body.paths['/admin/posts/generate/config'] as {
      get?: {
        responses?: Record<string, { content?: { 'application/json'?: { example?: unknown } } }>;
      };
      put?: {
        requestBody?: {
          content?: { 'application/json'?: { schema?: unknown; example?: unknown } };
        };
      };
    };

    const getExample = configPath.get?.responses?.['200']?.content?.['application/json']?.example as
      | {
          data?: {
            config?: {
              topicsRouting?: Record<string, unknown>;
              draftRouting?: Record<string, unknown>;
            };
          };
        }
      | undefined;

    const putSchema = configPath.put?.requestBody?.content?.['application/json']?.schema as
      | { properties?: Record<string, unknown> }
      | undefined;
    const putExample = configPath.put?.requestBody?.content?.['application/json']?.example as
      | {
          topicsRouting?: Record<string, unknown>;
          draftRouting?: Record<string, unknown>;
        }
      | undefined;

    expect(getExample?.data?.config?.topicsRouting).toMatchObject({
      mode: 'low-latency',
    });
    expect(getExample?.data?.config?.draftRouting).toMatchObject({
      mode: 'manual',
    });
    expect(putSchema?.properties && Object.hasOwn(putSchema.properties, 'topicsRouting')).toBe(
      true
    );
    expect(putSchema?.properties && Object.hasOwn(putSchema.properties, 'draftRouting')).toBe(true);
    expect(putExample?.topicsRouting).toMatchObject({
      mode: 'low-latency',
      preferredMaxLatencySeconds: 10,
    });
    expect(putExample?.draftRouting).toMatchObject({
      mode: 'manual',
      providerOrder: ['openai', 'anthropic'],
    });
  });
});
