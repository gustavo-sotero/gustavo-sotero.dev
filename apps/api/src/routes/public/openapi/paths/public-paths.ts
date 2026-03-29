/**
 * OpenAPI path definitions for all public (unauthenticated) routes.
 * Includes: developer profile, documentation, health, posts, projects, tags,
 * comments, contact, feed/sitemap, auth, experience, education.
 */

export const publicPaths = {
  // ── Developer Profile ───────────────────────────────────────────────────────
  '/developer/profile': {
    get: {
      tags: ['Developer'],
      summary: 'Aggregated developer profile',
      description:
        'Returns a complete, aggregated snapshot of the developer profile.\n\n' +
        'Includes:\n' +
        '- Personal identity (name, role, bio, links)\n' +
        '- Technology stack grouped by category (language, framework, tool, db, etc.)\n' +
        '- Professional experience timeline\n' +
        '- Educational background\n' +
        '- Recent/featured projects (up to 5)\n' +
        '- Recent published posts (up to 5)\n' +
        '- Public aggregate metrics (post/project/tag counts, pageviews last 30 days)\n\n' +
        'Response is always serialized as pretty-printed JSON for enhanced human readability.',
      operationId: 'getDeveloperProfile',
      responses: {
        '200': {
          description: 'Aggregated developer profile',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data'],
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    required: [
                      'profile',
                      'stack',
                      'experience',
                      'education',
                      'projects',
                      'posts',
                      'metrics',
                      'updatedAt',
                    ],
                    properties: {
                      profile: {
                        type: 'object',
                        description: 'Developer identity and contact links',
                        required: ['name', 'role', 'bio', 'availability', 'links'],
                        properties: {
                          name: { type: 'string', example: 'Gustavo Sotero' },
                          role: { type: 'string', example: 'Desenvolvedor Fullstack' },
                          bio: { type: 'string' },
                          location: { type: 'string', nullable: true, example: 'Brasil' },
                          availability: {
                            type: 'string',
                            example: 'Disponível para novos projetos',
                          },
                          links: {
                            type: 'object',
                            properties: {
                              github: { type: 'string', format: 'uri' },
                              linkedin: { type: 'string', format: 'uri' },
                              website: { type: 'string', format: 'uri', nullable: true },
                              telegram: { type: 'string', format: 'uri', nullable: true },
                              whatsapp: { type: 'string', format: 'uri', nullable: true },
                            },
                          },
                          contacts: {
                            type: 'object',
                            properties: {
                              email: { type: 'string', format: 'email', nullable: true },
                              phone: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      stack: {
                        type: 'object',
                        description: 'Technology stack grouped by category',
                        properties: {
                          groups: {
                            type: 'object',
                            properties: {
                              language: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              framework: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              tool: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              db: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              cloud: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              infra: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                              other: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/TagPublic' },
                              },
                            },
                          },
                        },
                      },
                      experience: {
                        type: 'array',
                        description: 'Published professional experience entries',
                        items: {
                          type: 'object',
                          required: ['id', 'slug', 'company', 'role', 'startDate', 'isCurrent'],
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            company: { type: 'string' },
                            role: { type: 'string' },
                            description: { type: 'string' },
                            location: { type: 'string', nullable: true },
                            employmentType: { type: 'string', nullable: true },
                            startDate: { type: 'string', format: 'date-time' },
                            endDate: { type: 'string', format: 'date-time', nullable: true },
                            isCurrent: { type: 'boolean' },
                            order: { type: 'integer' },
                            logoUrl: { type: 'string', nullable: true },
                          },
                        },
                      },
                      education: {
                        type: 'array',
                        description: 'Published educational background entries',
                        items: {
                          type: 'object',
                          required: ['id', 'slug', 'title', 'institution', 'isCurrent'],
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            title: { type: 'string' },
                            institution: { type: 'string' },
                            description: { type: 'string', nullable: true },
                            location: { type: 'string', nullable: true },
                            educationType: { type: 'string', nullable: true },
                            startDate: { type: 'string', format: 'date-time', nullable: true },
                            endDate: { type: 'string', format: 'date-time', nullable: true },
                            isCurrent: { type: 'boolean' },
                            workloadHours: { type: 'integer', nullable: true },
                            order: { type: 'integer' },
                            logoUrl: { type: 'string', nullable: true },
                          },
                        },
                      },
                      projects: {
                        type: 'array',
                        description: 'Recent/featured published projects (up to 5)',
                        items: {
                          type: 'object',
                          required: ['id', 'slug', 'title', 'featured', 'createdAt', 'updatedAt'],
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string', nullable: true },
                            coverUrl: { type: 'string', nullable: true },
                            featured: { type: 'boolean' },
                            repositoryUrl: { type: 'string', nullable: true },
                            liveUrl: { type: 'string', nullable: true },
                            createdAt: { type: 'string', format: 'date-time' },
                            updatedAt: { type: 'string', format: 'date-time' },
                            tags: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/TagPublic' },
                            },
                          },
                        },
                      },
                      posts: {
                        type: 'array',
                        description: 'Recent published posts (up to 5)',
                        items: {
                          type: 'object',
                          required: ['id', 'slug', 'title', 'createdAt', 'updatedAt'],
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            title: { type: 'string' },
                            excerpt: { type: 'string', nullable: true },
                            coverUrl: { type: 'string', nullable: true },
                            publishedAt: { type: 'string', format: 'date-time', nullable: true },
                            createdAt: { type: 'string', format: 'date-time' },
                            updatedAt: { type: 'string', format: 'date-time' },
                            tags: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/TagPublic' },
                            },
                          },
                        },
                      },
                      metrics: {
                        type: 'object',
                        description: 'Public aggregate metrics',
                        required: [
                          'totalPostsPublished',
                          'totalProjectsPublished',
                          'totalTagsInUse',
                          'pageviews30d',
                          'lastCalculatedAt',
                        ],
                        properties: {
                          totalPostsPublished: { type: 'integer', example: 12 },
                          totalProjectsPublished: { type: 'integer', example: 5 },
                          totalTagsInUse: { type: 'integer', example: 18 },
                          pageviews30d: { type: 'integer', example: 3240 },
                          lastCalculatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                      updatedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'ISO timestamp of when this payload was composed',
                      },
                    },
                  },
                },
              },
              example: {
                success: true,
                data: {
                  profile: {
                    name: 'Gustavo Sotero',
                    role: 'Desenvolvedor Fullstack',
                    bio: 'Desenvolvedor Fullstack com 3+ anos construindo sistemas...',
                    location: 'Brasil',
                    availability: 'Disponível para novos projetos',
                    links: {
                      github: 'https://github.com/gustavosotero',
                      linkedin: 'https://linkedin.com/in/gustavosotero',
                      website: 'https://gustavo-sotero.dev',
                      telegram: 'https://t.me/gustavosotero',
                      whatsapp: 'https://wa.me/5500000000000',
                    },
                    contacts: {
                      email: 'contato@gustavo-sotero.dev',
                      phone: '+55 00 00000-0000',
                    },
                  },
                  stack: {
                    groups: {
                      language: [
                        {
                          id: 1,
                          name: 'TypeScript',
                          slug: 'typescript',
                          category: 'language',
                          iconKey: 'si:SiTypescript',
                        },
                      ],
                      framework: [
                        {
                          id: 2,
                          name: 'Hono',
                          slug: 'hono',
                          category: 'framework',
                          iconKey: 'si:SiHono',
                        },
                      ],
                      tool: [],
                      db: [
                        {
                          id: 3,
                          name: 'PostgreSQL',
                          slug: 'postgresql',
                          category: 'db',
                          iconKey: 'si:SiPostgresql',
                        },
                      ],
                      cloud: [],
                      infra: [],
                      other: [],
                    },
                  },
                  experience: [
                    {
                      id: 1,
                      slug: 'senior-developer-acme',
                      company: 'Acme Corp',
                      role: 'Senior Developer',
                      description: 'Led backend architecture for high-traffic services.',
                      location: 'Remote',
                      employmentType: 'full-time',
                      startDate: '2022-01-01T00:00:00.000Z',
                      endDate: null,
                      isCurrent: true,
                      order: 0,
                      logoUrl: null,
                    },
                  ],
                  education: [
                    {
                      id: 1,
                      slug: 'bsc-computer-science',
                      title: 'Bacharelado em Ciência da Computação',
                      institution: 'Universidade Federal',
                      description: null,
                      location: 'São Paulo, Brasil',
                      educationType: 'graduation',
                      startDate: '2018-01-01T00:00:00.000Z',
                      endDate: '2022-12-01T00:00:00.000Z',
                      isCurrent: false,
                      workloadHours: null,
                      order: 0,
                      logoUrl: null,
                    },
                  ],
                  projects: [
                    {
                      id: 1,
                      slug: 'portfolio-api',
                      title: 'Portfolio API',
                      description: 'Production-grade REST API with Bun + Hono + Drizzle.',
                      coverUrl: null,
                      featured: true,
                      repositoryUrl: 'https://github.com/example/portfolio',
                      liveUrl: 'https://gustavo-sotero.dev/api',
                      createdAt: '2025-01-01T00:00:00.000Z',
                      updatedAt: '2025-06-01T00:00:00.000Z',
                      tags: [
                        {
                          id: 1,
                          name: 'TypeScript',
                          slug: 'typescript',
                          category: 'language',
                          iconKey: 'si:SiTypescript',
                        },
                      ],
                    },
                  ],
                  posts: [
                    {
                      id: 1,
                      slug: 'building-apis-with-hono',
                      title: 'Building APIs with Hono and Bun',
                      excerpt: 'How I built a production-grade API with Hono.',
                      coverUrl: null,
                      publishedAt: '2025-03-15T12:00:00.000Z',
                      createdAt: '2025-03-10T00:00:00.000Z',
                      updatedAt: '2025-03-15T12:00:00.000Z',
                      tags: [],
                    },
                  ],
                  metrics: {
                    totalPostsPublished: 12,
                    totalProjectsPublished: 5,
                    totalTagsInUse: 18,
                    pageviews30d: 3240,
                    lastCalculatedAt: '2026-02-27T10:00:00.000Z',
                  },
                  updatedAt: '2026-02-27T10:00:00.000Z',
                },
              },
            },
          },
        },
      },
    },
  },

  // ── Documentation ────────────────────────────────────────────────────────────
  '/doc/spec': {
    get: {
      tags: ['Documentation'],
      summary: 'OpenAPI 3.1 specification',
      description: 'Returns the OpenAPI 3.1 contract as JSON.',
      operationId: 'getOpenApiSpec',
      responses: {
        '200': {
          description: 'OpenAPI specification',
          headers: {
            'Cache-Control': {
              schema: { type: 'string' },
              example: 'public, s-maxage=3600, stale-while-revalidate=300',
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  openapi: { type: 'string', example: '3.1.0' },
                  info: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', example: 'Portfolio API' },
                      version: { type: 'string', example: '1.0.0' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/doc': {
    get: {
      tags: ['Documentation'],
      summary: 'Swagger UI',
      description: 'Returns the interactive Swagger UI page for this API.',
      operationId: 'getSwaggerUi',
      responses: {
        '200': {
          description: 'Swagger UI HTML',
          content: { 'text/html': { schema: { type: 'string' } } },
        },
      },
    },
  },

  // ── Health ──────────────────────────────────────────────────────────────────
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Returns 200 if the process is alive.',
      operationId: 'getHealth',
      responses: {
        '200': {
          description: 'Service alive',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
              example: {
                success: true,
                data: { status: 'ok', uptime: 42.5, timestamp: '2026-01-01T00:00:00.000Z' },
              },
            },
          },
        },
      },
    },
  },
  '/ready': {
    get: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Checks database connectivity, Redis connectivity, and required schema parity.',
      operationId: 'getReady',
      responses: {
        '200': {
          description: 'All dependencies healthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
              example: { success: true, data: { db: 'ok', redis: 'ok', schema: 'ok' } },
            },
          },
        },
        '503': {
          description: 'One or more dependencies unhealthy',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
      },
    },
  },

  // ── Posts ───────────────────────────────────────────────────────────────────
  '/posts': {
    get: {
      tags: ['Posts'],
      summary: 'List published posts',
      operationId: 'listPosts',
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { $ref: '#/components/parameters/tag' },
      ],
      responses: {
        '200': {
          description: 'Paginated list of published posts',
          headers: {
            'Cache-Control': {
              schema: { type: 'string' },
              example: 'public, s-maxage=300, stale-while-revalidate=60',
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/posts/{slug}': {
    get: {
      tags: ['Posts'],
      summary: 'Get post by slug',
      description: 'Returns a published post with pre-rendered HTML and approved comments.',
      operationId: 'getPostBySlug',
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          schema: { type: 'string', example: 'hello-world' },
        },
      ],
      responses: {
        '200': {
          description: 'Post with comments',
          headers: {
            'Cache-Control': {
              schema: { type: 'string' },
              example: 'public, s-maxage=3600, stale-while-revalidate=300',
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    allOf: [
                      { $ref: '#/components/schemas/Post' },
                      {
                        type: 'object',
                        properties: {
                          comments: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Comment' },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Projects ────────────────────────────────────────────────────────────────
  '/projects': {
    get: {
      tags: ['Projects'],
      summary: 'List published projects',
      operationId: 'listProjects',
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { $ref: '#/components/parameters/tag' },
        {
          name: 'featured',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Filter to featured projects only',
        },
      ],
      responses: {
        '200': {
          description: 'Paginated list of published projects',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/projects/{slug}': {
    get: {
      tags: ['Projects'],
      summary: 'Get project by slug',
      operationId: 'getProjectBySlug',
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          schema: { type: 'string', example: 'my-project' },
        },
      ],
      responses: {
        '200': {
          description: 'Project detail',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Project' },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Tags ────────────────────────────────────────────────────────────────────
  '/tags': {
    get: {
      tags: ['Tags'],
      summary: 'List tags in use',
      description: 'Returns only tags used by at least one published post or project.',
      operationId: 'listTags',
      parameters: [
        {
          name: 'category',
          in: 'query',
          schema: { type: 'string', example: 'language,framework' },
          description: 'Comma-separated category filter',
        },
      ],
      responses: {
        '200': {
          description: 'List of tags',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
                },
              },
            },
          },
        },
      },
    },
  },

  // ── Comments ────────────────────────────────────────────────────────────────
  '/comments': {
    post: {
      tags: ['Comments'],
      summary: 'Submit a comment',
      description:
        'Creates a pending comment. Requires Cloudflare Turnstile validation.\n\nRate limited: 5 req/min per IP.',
      operationId: 'createComment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['postId', 'authorName', 'authorEmail', 'content', 'turnstileToken'],
              properties: {
                postId: { type: 'integer', example: 1 },
                parentCommentId: {
                  type: 'string',
                  format: 'uuid',
                  description:
                    'Optional. UUID of the comment being replied to. Validates parent exists, belongs to the same post, and is not deleted.',
                },
                authorName: { type: 'string', minLength: 2, maxLength: 100, example: 'Jane' },
                authorEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
                content: { type: 'string', minLength: 3, maxLength: 2000 },
                turnstileToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Comment submitted for moderation',
          content: {
            'application/json': {
              example: { success: true, data: { message: 'Comment sent for moderation' } },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '429': { $ref: '#/components/responses/RateLimited' },
      },
    },
  },

  // ── Contact ─────────────────────────────────────────────────────────────────
  '/contact': {
    post: {
      tags: ['Contact'],
      summary: 'Send contact message',
      description:
        'Saves a contact message and triggers a Telegram notification.\n\nRate limited: 5 req/min per IP. Includes honeypot field for bot detection.',
      operationId: 'sendContactMessage',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'message', 'turnstileToken'],
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 100 },
                email: { type: 'string', format: 'email' },
                message: { type: 'string', minLength: 10, maxLength: 5000 },
                turnstileToken: { type: 'string' },
                website: { type: 'string', maxLength: 0, description: 'Honeypot — must be empty' },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Message received' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '429': { $ref: '#/components/responses/RateLimited' },
      },
    },
  },

  // ── Feed & Sitemap ──────────────────────────────────────────────────────────
  '/feed.xml': {
    get: {
      tags: ['Feed'],
      summary: 'RSS 2.0 feed',
      description: 'Returns the 20 most recent published posts as RSS 2.0.',
      operationId: 'getRssFeed',
      responses: {
        '200': {
          description: 'RSS 2.0 XML feed',
          content: { 'application/rss+xml': { schema: { type: 'string' } } },
        },
      },
    },
  },
  '/sitemap.xml': {
    get: {
      tags: ['Feed'],
      summary: 'XML sitemap',
      description: 'Returns a sitemap including all public routes and published content.',
      operationId: 'getSitemap',
      responses: {
        '200': {
          description: 'XML sitemap',
          content: { 'application/xml': { schema: { type: 'string' } } },
        },
      },
    },
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  '/auth/github/start': {
    post: {
      tags: ['Auth'],
      summary: 'Start GitHub OAuth flow',
      description: 'Generates a state token and returns the GitHub authorization URL.',
      operationId: 'authGithubStart',
      responses: {
        '200': { description: 'Authorization URL returned' },
        '429': { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/auth/github/callback': {
    get: {
      tags: ['Auth'],
      summary: 'GitHub OAuth callback',
      description: 'Exchanges OAuth code, verifies admin GitHub ID, and issues JWT + CSRF cookies.',
      operationId: 'authGithubCallback',
      parameters: [
        { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '302': { description: 'Redirects to admin dashboard on success' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout',
      description: 'Clears admin_token and csrf_token cookies.',
      operationId: 'authLogout',
      security: [{ cookieAuth: [] }],
      responses: { '200': { description: 'Logged out successfully' } },
    },
  },

  // ── Experience (Public) ───────────────────────────────────────────────────────
  '/experience': {
    get: {
      tags: ['Experience'],
      summary: 'List published experience entries',
      operationId: 'listExperience',
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
      ],
      responses: {
        '200': {
          description: 'Paginated list of experience entries',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Experience' },
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/experience/{slug}': {
    get: {
      tags: ['Experience'],
      summary: 'Get experience entry by slug',
      operationId: 'getExperienceBySlug',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Experience entry detail',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  { properties: { data: { $ref: '#/components/schemas/Experience' } } },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Education (Public) ────────────────────────────────────────────────────────
  '/education': {
    get: {
      tags: ['Education'],
      summary: 'List published education entries',
      operationId: 'listEducation',
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
      ],
      responses: {
        '200': {
          description: 'Paginated list of education entries',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  {
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Education' },
                      },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/education/{slug}': {
    get: {
      tags: ['Education'],
      summary: 'Get education entry by slug',
      operationId: 'getEducationBySlug',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Education entry detail',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessResponse' },
                  { properties: { data: { $ref: '#/components/schemas/Education' } } },
                ],
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
} as const;
