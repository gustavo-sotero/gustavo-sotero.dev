/**
 * OpenAPI 3.1 reusable components: schemas, parameters, responses, securitySchemes.
 */

export const openApiComponents = {
  securitySchemes: {
    cookieAuth: {
      type: 'apiKey',
      in: 'cookie',
      name: 'admin_token',
      description: 'HTTP-only JWT cookie issued after GitHub OAuth',
    },
  },
  schemas: {
    SuccessResponse: {
      type: 'object',
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean', example: true },
        data: { description: 'Response payload' },
      },
    },
    ErrorResponse: {
      type: 'object',
      required: ['success', 'error'],
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
              example: 'NOT_FOUND',
              enum: [
                'VALIDATION_ERROR',
                'UNAUTHORIZED',
                'FORBIDDEN',
                'NOT_FOUND',
                'CONFLICT',
                'RATE_LIMITED',
                'SERVICE_UNAVAILABLE',
                'INTERNAL_ERROR',
              ],
            },
            message: { type: 'string', example: 'Resource not found' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    PaginationMeta: {
      type: 'object',
      required: ['page', 'perPage', 'total', 'totalPages'],
      properties: {
        page: { type: 'integer', example: 1 },
        perPage: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 42 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
    Tag: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        name: { type: 'string', example: 'TypeScript' },
        slug: { type: 'string', example: 'typescript' },
        category: {
          type: 'string',
          enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra', 'other'],
          example: 'language',
        },
        iconKey: { type: 'string', nullable: true, example: 'si:SiTypescript' },
        isHighlighted: {
          type: 'boolean',
          example: false,
          description:
            'Whether this tag is highlighted as a key specialisation. Max 2 per category.',
        },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    TagPublic: {
      type: 'object',
      description: 'Simplified tag shape used in the developer profile payload (no admin fields)',
      required: ['id', 'name', 'slug', 'category'],
      properties: {
        id: { type: 'integer', example: 1 },
        name: { type: 'string', example: 'TypeScript' },
        slug: { type: 'string', example: 'typescript' },
        category: {
          type: 'string',
          enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra', 'other'],
          example: 'language',
        },
        iconKey: { type: 'string', nullable: true, example: 'si:SiTypescript' },
      },
    },
    Post: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        slug: { type: 'string', example: 'hello-world' },
        title: { type: 'string', example: 'Hello World' },
        excerpt: { type: 'string', nullable: true },
        renderedContent: { type: 'string', description: 'Pre-rendered HTML' },
        coverUrl: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['draft', 'published', 'scheduled'] },
        publishedAt: { type: 'string', format: 'date-time', nullable: true },
        scheduledAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description:
            'UTC datetime when the post will be automatically published (status=scheduled only)',
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
      },
    },
    Project: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        slug: { type: 'string', example: 'my-project' },
        title: { type: 'string', example: 'My Project' },
        description: { type: 'string', nullable: true },
        renderedContent: { type: 'string', description: 'Pre-rendered HTML' },
        coverUrl: { type: 'string', nullable: true },
        repositoryUrl: { type: 'string', nullable: true },
        liveUrl: { type: 'string', nullable: true },
        featured: { type: 'boolean', example: false },
        order: { type: 'integer', example: 0 },
        status: { type: 'string', enum: ['draft', 'published'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
      },
    },
    Comment: {
      type: 'object',
      description:
        'A public comment node. Includes nested replies (tree structure). Private fields (email, ipHash) are never exposed.',
      properties: {
        id: { type: 'string', format: 'uuid' },
        postId: { type: 'integer', example: 1 },
        parentCommentId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'UUID of the parent comment. NULL for root comments.',
        },
        authorName: { type: 'string', example: 'Jane Doe' },
        authorRole: {
          type: 'string',
          enum: ['guest', 'admin'],
          example: 'guest',
          description: 'guest = anonymous submitter, admin = site owner reply.',
        },
        content: { type: 'string', example: 'Great post!' },
        renderedContent: {
          type: 'string',
          description: 'Pre-rendered safe HTML',
          nullable: true,
        },
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        createdAt: { type: 'string', format: 'date-time' },
        replies: {
          type: 'array',
          description: 'Nested replies (same shape, recursive).',
          items: { $ref: '#/components/schemas/Comment' },
        },
      },
    },
    Experience: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        slug: { type: 'string', example: 'software-engineer-acme' },
        role: { type: 'string', example: 'Software Engineer' },
        company: { type: 'string', example: 'Acme Corp' },
        description: { type: 'string' },
        location: { type: 'string', nullable: true, example: 'São Paulo, BR' },
        employmentType: { type: 'string', nullable: true, example: 'Full-time' },
        startDate: { type: 'string', format: 'date', example: '2022-01-01' },
        endDate: { type: 'string', format: 'date', nullable: true, example: '2024-12-31' },
        isCurrent: { type: 'boolean', example: false },
        order: { type: 'integer', example: 0 },
        status: { type: 'string', enum: ['draft', 'published'] },
        logoUrl: { type: 'string', nullable: true },
        credentialUrl: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    Education: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 1 },
        slug: { type: 'string', example: 'bsc-computer-science-usp' },
        title: { type: 'string', example: 'BSc. Ciência da Computação' },
        institution: { type: 'string', example: 'Universidade de São Paulo' },
        description: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        educationType: { type: 'string', nullable: true, example: 'Degree' },
        startDate: { type: 'string', format: 'date', nullable: true },
        endDate: { type: 'string', format: 'date', nullable: true },
        isCurrent: { type: 'boolean', example: false },
        workloadHours: { type: 'integer', nullable: true, example: 3600 },
        credentialId: { type: 'string', nullable: true },
        credentialUrl: { type: 'string', nullable: true },
        order: { type: 'integer', example: 0 },
        status: { type: 'string', enum: ['draft', 'published'] },
        logoUrl: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  parameters: {
    page: {
      name: 'page',
      in: 'query',
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: 'Page number',
    },
    perPage: {
      name: 'perPage',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      description: 'Items per page',
    },
    tag: {
      name: 'tag',
      in: 'query',
      schema: { type: 'string' },
      description: 'Filter by tag slug',
    },
  },
  responses: {
    ValidationError: {
      description: 'Validation error',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
    Unauthorized: {
      description: 'Authentication required',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
    Forbidden: {
      description: 'Access denied or invalid CSRF token',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
    RateLimited: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
    Conflict: {
      description: 'Resource conflict (e.g. duplicate slug or constraint violation)',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
      },
    },
  },
} as const;
