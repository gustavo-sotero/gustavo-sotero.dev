/**
 * OpenAPI path definitions for all admin (JWT-required) routes.
 * Includes: posts, projects, tags, comments, contacts, uploads, analytics,
 * experience, education, and background job monitoring.
 */

export const adminPaths = {
  // ── Admin Posts ─────────────────────────────────────────────────────────────
  '/admin/posts': {
    get: {
      tags: ['Admin - Posts'],
      summary: 'List all posts',
      operationId: 'adminListPosts',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { $ref: '#/components/parameters/tag' },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['draft', 'published', 'scheduled'] },
        },
      ],
      responses: {
        '200': { description: 'Paginated post list (all statuses)' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Admin - Posts'],
      summary: 'Create post',
      operationId: 'adminCreatePost',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'content'],
              properties: {
                title: { type: 'string' },
                slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                content: { type: 'string' },
                excerpt: { type: 'string', maxLength: 500 },
                coverUrl: { type: 'string', format: 'uri' },
                status: {
                  type: 'string',
                  enum: ['draft', 'published', 'scheduled'],
                  default: 'draft',
                },
                scheduledAt: {
                  type: 'string',
                  format: 'date-time',
                  description:
                    "Required when status is 'scheduled'. Must be a future UTC datetime.",
                },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Post created' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/admin/posts/{id}': {
    patch: {
      tags: ['Admin - Posts'],
      summary: 'Update post',
      operationId: 'adminUpdatePost',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description:
                'Partial post update. Supports scheduled publication via status=scheduled + scheduledAt.',
              properties: {
                title: { type: 'string' },
                slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                content: { type: 'string' },
                excerpt: { type: 'string', maxLength: 500 },
                coverUrl: { type: 'string', format: 'uri' },
                status: { type: 'string', enum: ['draft', 'published', 'scheduled'] },
                scheduledAt: {
                  type: 'string',
                  format: 'date-time',
                  description: "Required when status is 'scheduled'",
                },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Post updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
    delete: {
      tags: ['Admin - Posts'],
      summary: 'Soft delete post',
      operationId: 'adminDeletePost',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '204': { description: 'Post soft-deleted' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Admin Projects ──────────────────────────────────────────────────────────
  '/admin/projects': {
    get: {
      tags: ['Admin - Projects'],
      summary: 'List all projects',
      operationId: 'adminListProjects',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { $ref: '#/components/parameters/tag' },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['draft', 'published'] },
        },
        {
          name: 'featured',
          in: 'query',
          schema: { type: 'boolean' },
        },
      ],
      responses: { '200': { description: 'Paginated project list' } },
    },
    post: {
      tags: ['Admin - Projects'],
      summary: 'Create project',
      operationId: 'adminCreateProject',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string' },
                slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                description: { type: 'string', maxLength: 500 },
                content: { type: 'string' },
                coverUrl: { type: 'string', format: 'uri' },
                status: {
                  type: 'string',
                  enum: ['draft', 'published'],
                  default: 'draft',
                },
                repositoryUrl: { type: 'string', format: 'uri' },
                liveUrl: { type: 'string', format: 'uri' },
                featured: { type: 'boolean', default: false },
                order: { type: 'integer', default: 0 },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Project created' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/admin/projects/{id}': {
    patch: {
      tags: ['Admin - Projects'],
      summary: 'Update project',
      operationId: 'adminUpdateProject',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                description: { type: 'string', maxLength: 500 },
                content: { type: 'string' },
                coverUrl: { type: 'string', format: 'uri' },
                status: { type: 'string', enum: ['draft', 'published'] },
                repositoryUrl: { type: 'string', format: 'uri' },
                liveUrl: { type: 'string', format: 'uri' },
                featured: { type: 'boolean' },
                order: { type: 'integer' },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Project updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
    delete: {
      tags: ['Admin - Projects'],
      summary: 'Soft delete project',
      operationId: 'adminDeleteProject',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '204': { description: 'Project soft-deleted' } },
    },
  },

  // ── Admin Tags ──────────────────────────────────────────────────────────────
  '/admin/tags': {
    get: {
      tags: ['Admin - Tags'],
      summary: 'List all tags',
      operationId: 'adminListTags',
      security: [{ cookieAuth: [] }],
      responses: { '200': { description: 'All tags' } },
    },
    post: {
      tags: ['Admin - Tags'],
      summary: 'Create tag',
      operationId: 'adminCreateTag',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100, example: 'TypeScript' },
                category: {
                  type: 'string',
                  enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra', 'other'],
                  default: 'other',
                  description:
                    'Tag category. iconKey is auto-resolved from name + category by the system.',
                },
                isHighlighted: {
                  type: 'boolean',
                  default: false,
                  description: 'Mark as highlighted specialisation. Max 2 per category.',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Tag created',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '409': { description: 'Name conflict or highlight limit exceeded (max 2 per category)' },
      },
    },
  },
  '/admin/tags/{id}': {
    patch: {
      tags: ['Admin - Tags'],
      summary: 'Update tag',
      operationId: 'adminUpdateTag',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description:
                'All fields optional. iconKey is recalculated server-side from name + category.',
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                category: {
                  type: 'string',
                  enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra', 'other'],
                  description: 'Changing category triggers automatic iconKey recalculation.',
                },
                isHighlighted: {
                  type: 'boolean',
                  description: 'Mark as highlighted specialisation. Max 2 per category.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Tag updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Name conflict or highlight limit exceeded (max 2 per category)' },
      },
    },
    delete: {
      tags: ['Admin - Tags'],
      summary: 'Delete tag',
      operationId: 'adminDeleteTag',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '204': { description: 'Tag deleted' } },
    },
  },

  // ── Admin Comments ──────────────────────────────────────────────────────────
  '/admin/comments': {
    get: {
      tags: ['Admin - Comments'],
      summary: 'List comments',
      description:
        'Paginated list of all comments. Supports filtering by status, deleted state, and post. By default excludes soft-deleted comments.',
      operationId: 'adminListComments',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'status',
          in: 'query',
          description: 'Filter by moderation status.',
          schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          example: 'pending',
        },
        {
          name: 'deleted',
          in: 'query',
          description:
            'When true, return only soft-deleted comments. Omit or set false to exclude deleted.',
          schema: { type: 'boolean' },
          example: false,
        },
        {
          name: 'postId',
          in: 'query',
          description: 'Filter comments for a specific post ID.',
          schema: { type: 'integer' },
          example: 1,
        },
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
      ],
      responses: { '200': { description: 'Paginated comment list' } },
    },
  },
  '/admin/comments/reply': {
    post: {
      tags: ['Admin - Comments'],
      summary: 'Post admin reply',
      description:
        'Creates an admin-authored reply to an existing comment. Auto-approved — no moderation round-trip needed. Attributed to the site owner.',
      operationId: 'adminReplyComment',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['postId', 'parentCommentId', 'content'],
              properties: {
                postId: { type: 'integer', example: 1 },
                parentCommentId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the comment to reply to. Must belong to postId.',
                },
                content: { type: 'string', minLength: 1, maxLength: 2000 },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Admin reply created and auto-approved' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/admin/comments/{id}/status': {
    patch: {
      tags: ['Admin - Comments'],
      summary: 'Update comment status',
      description:
        'Reversible status transition: pending ↔ approved ↔ rejected. Records moderatedAt/moderatedBy audit metadata. Invalidates post cache when the transition affects public visibility.',
      operationId: 'adminUpdateCommentStatus',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                reason: { type: 'string', maxLength: 500, description: 'Optional audit note.' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Status updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Cannot change status of a deleted comment' },
      },
    },
  },
  '/admin/comments/{id}/content': {
    patch: {
      tags: ['Admin - Comments'],
      summary: 'Edit comment content',
      description:
        'Admin-only edit of a comment body. Re-runs comment markdown sanitize pipeline. Records editedAt/editedBy/editReason audit metadata.',
      operationId: 'adminEditCommentContent',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['content'],
              properties: {
                content: { type: 'string', minLength: 1, maxLength: 2000 },
                reason: {
                  type: 'string',
                  maxLength: 500,
                  description: 'Optional audit note, e.g. "removed offensive content".',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Content updated and re-rendered' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Cannot edit a deleted comment' },
      },
    },
  },
  '/admin/comments/{id}': {
    delete: {
      tags: ['Admin - Comments'],
      summary: 'Soft-delete comment',
      description:
        'Soft-deletes a comment (sets deletedAt/deletedBy/deleteReason). Row is preserved for audit and data-retention job compatibility. Deleted comments are excluded from all public responses.',
      operationId: 'adminDeleteComment',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  maxLength: 500,
                  description: 'Optional audit reason for the deletion.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Comment soft-deleted' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Comment is already deleted' },
      },
    },
  },
  '/admin/comments/{id}/approve': {
    post: {
      tags: ['Admin - Comments'],
      summary: 'Approve comment (legacy)',
      description:
        'Convenience endpoint — maps to PATCH /admin/comments/{id}/status with status=approved. Prefer the generic status endpoint for new integrations.',
      operationId: 'adminApproveComment',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Comment approved' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Comment already approved or deleted' },
      },
    },
  },
  '/admin/comments/{id}/reject': {
    post: {
      tags: ['Admin - Comments'],
      summary: 'Reject comment (legacy)',
      description:
        'Convenience endpoint — maps to PATCH /admin/comments/{id}/status with status=rejected. Prefer the generic status endpoint for new integrations.',
      operationId: 'adminRejectComment',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Comment rejected' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Comment already rejected or deleted' },
      },
    },
  },

  // ── Admin Contacts ──────────────────────────────────────────────────────────
  '/admin/contacts': {
    get: {
      tags: ['Admin - Contacts'],
      summary: 'List contact messages',
      operationId: 'adminListContacts',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        {
          name: 'read',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Filter by read status',
        },
      ],
      responses: { '200': { description: 'Paginated contact list' } },
    },
  },
  '/admin/contacts/{id}/read': {
    patch: {
      tags: ['Admin - Contacts'],
      summary: 'Mark contact as read',
      operationId: 'adminMarkContactRead',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': { description: 'Contact marked as read' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Admin Uploads ────────────────────────────────────────────────────────────
  '/admin/uploads/presign': {
    post: {
      tags: ['Admin - Uploads'],
      summary: 'Request presigned upload URL',
      operationId: 'adminPresignUpload',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mime', 'size', 'filename'],
              properties: {
                mime: {
                  type: 'string',
                  enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                },
                size: { type: 'integer', maximum: 5242880, description: 'File size in bytes' },
                filename: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Presigned URL generated',
          content: {
            'application/json': {
              example: {
                presignedUrl: 'https://...',
                key: 'uploads/2026/01/uuid.jpg',
                uploadId: 'uuid',
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/admin/uploads/{id}/confirm': {
    post: {
      tags: ['Admin - Uploads'],
      summary: 'Confirm upload and schedule optimization via outbox',
      description:
        'Transitions the upload status from `pending` to `uploaded` and writes an `image-optimize` outbox event for asynchronous delivery to the worker. ' +
        'The response is **immediate** and reflects the pre-optimization state — `optimizedUrl` and `variants` ' +
        'will be `null` at this point. Poll `GET /admin/uploads/{id}` to track when the job completes ' +
        '(`status: "processed"`) and retrieve the final optimized URLs.',
      operationId: 'adminConfirmUpload',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description:
            'Upload confirmed and outbox event persisted. Status is `uploaded` — not yet `processed`.',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  id: '4fd8d866-22f5-4d2e-a3be-0a77cd8e1234',
                  originalUrl: 'https://cdn.example.com/uploads/2026/02/uuid.jpg',
                  optimizedUrl: null,
                  variants: null,
                  mime: 'image/jpeg',
                  size: 102400,
                  width: null,
                  height: null,
                  status: 'uploaded',
                  createdAt: '2026-02-25T18:20:41.182Z',
                  message: 'Upload confirmado com sucesso.',
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Upload already confirmed or not yet in S3' },
      },
    },
  },
  '/admin/uploads/{id}': {
    get: {
      tags: ['Admin - Uploads'],
      summary: 'Get upload status',
      description:
        'Returns the current status and metadata of an upload. ' +
        'Use this endpoint to poll for optimization completion after confirming an upload via `POST /admin/uploads/{id}/confirm`. ' +
        'A status of `uploaded` means the confirm step succeeded and the file is still waiting for relay and/or worker completion. ' +
        'Keep polling until `status` is `"processed"` (success) or `"failed"` (error). ' +
        'When `processed`, use `optimizedUrl` as the cover URL (falls back to `variants.medium` → `originalUrl`).',
      operationId: 'adminGetUpload',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Upload record',
          content: {
            'application/json': {
              examples: {
                processing: {
                  summary: 'Still processing (status: uploaded)',
                  value: {
                    success: true,
                    data: {
                      id: '4fd8d866-22f5-4d2e-a3be-0a77cd8e1234',
                      originalUrl: 'https://cdn.example.com/uploads/2026/02/uuid.jpg',
                      optimizedUrl: null,
                      variants: null,
                      mime: 'image/jpeg',
                      size: 102400,
                      width: null,
                      height: null,
                      status: 'uploaded',
                      createdAt: '2026-02-25T18:20:41.182Z',
                    },
                  },
                },
                processed: {
                  summary: 'Optimization complete (status: processed)',
                  value: {
                    success: true,
                    data: {
                      id: '4fd8d866-22f5-4d2e-a3be-0a77cd8e1234',
                      originalUrl: 'https://cdn.example.com/uploads/2026/02/uuid.jpg',
                      optimizedUrl: 'https://cdn.example.com/uploads/2026/02/uuid-opt.webp',
                      variants: {
                        thumbnail: 'https://cdn.example.com/uploads/2026/02/uuid-thumb.webp',
                        medium: 'https://cdn.example.com/uploads/2026/02/uuid-medium.webp',
                      },
                      mime: 'image/jpeg',
                      size: 102400,
                      width: 1200,
                      height: 630,
                      status: 'processed',
                      createdAt: '2026-02-25T18:20:41.182Z',
                    },
                  },
                },
                failed: {
                  summary: 'Optimization failed (status: failed)',
                  value: {
                    success: true,
                    data: {
                      id: '4fd8d866-22f5-4d2e-a3be-0a77cd8e1234',
                      originalUrl: 'https://cdn.example.com/uploads/2026/02/uuid.jpg',
                      optimizedUrl: null,
                      variants: null,
                      mime: 'image/jpeg',
                      size: 102400,
                      width: null,
                      height: null,
                      status: 'failed',
                      createdAt: '2026-02-25T18:20:41.182Z',
                    },
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

  // ── Admin Analytics ──────────────────────────────────────────────────────────
  '/admin/analytics/summary': {
    get: {
      tags: ['Admin - Analytics'],
      summary: 'Analytics summary',
      operationId: 'adminAnalyticsSummary',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'from',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          example: '2026-01-01',
        },
        {
          name: 'to',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          example: '2026-02-22',
        },
      ],
      responses: {
        '200': {
          description: 'Metrics summary',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  pageviews: 1234,
                  pendingComments: 3,
                  publishedPosts: 12,
                  publishedProjects: 5,
                },
              },
            },
          },
        },
      },
    },
  },
  '/admin/analytics/top-posts': {
    get: {
      tags: ['Admin - Analytics'],
      summary: 'Top posts by pageview',
      operationId: 'adminAnalyticsTopPosts',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      ],
      responses: { '200': { description: 'Top posts ranked by views' } },
    },
  },

  // ── Admin Experience ──────────────────────────────────────────────────────────
  '/admin/experience': {
    get: {
      tags: ['Admin - Experience'],
      summary: 'List all experience entries (admin)',
      operationId: 'adminListExperience',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published'] } },
      ],
      responses: {
        '200': { description: 'Paginated experience list (all statuses)' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Admin - Experience'],
      summary: 'Create experience entry',
      operationId: 'adminCreateExperience',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['role', 'company', 'description', 'startDate'],
              properties: {
                role: { type: 'string' },
                company: { type: 'string' },
                description: { type: 'string' },
                location: { type: 'string' },
                employmentType: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                isCurrent: { type: 'boolean' },
                order: { type: 'integer' },
                status: { type: 'string', enum: ['draft', 'published'] },
                logoUrl: { type: 'string' },
                credentialUrl: { type: 'string' },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Experience entry created' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/admin/experience/{identifier}': {
    get: {
      tags: ['Admin - Experience'],
      summary: 'Get experience entry by slug (admin)',
      operationId: 'adminGetExperience',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'identifier',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Experience slug.',
        },
      ],
      responses: {
        '200': { description: 'Experience detail' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Admin - Experience'],
      summary: 'Update experience entry',
      operationId: 'adminUpdateExperience',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'identifier',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Numeric experience ID.',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                company: { type: 'string' },
                description: { type: 'string' },
                slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                location: { type: 'string' },
                employmentType: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                isCurrent: { type: 'boolean' },
                order: { type: 'integer' },
                status: { type: 'string', enum: ['draft', 'published'] },
                logoUrl: { type: 'string' },
                credentialUrl: { type: 'string' },
                tagIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Tag IDs. Every submitted ID must exist in the tags table.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Experience updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
    delete: {
      tags: ['Admin - Experience'],
      summary: 'Soft delete experience entry',
      operationId: 'adminDeleteExperience',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'identifier',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Numeric experience ID.',
        },
      ],
      responses: {
        '204': { description: 'Deleted' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Admin Education ───────────────────────────────────────────────────────────
  '/admin/education': {
    get: {
      tags: ['Admin - Education'],
      summary: 'List all education entries (admin)',
      operationId: 'adminListEducation',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published'] } },
      ],
      responses: {
        '200': { description: 'Paginated education list (all statuses)' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Admin - Education'],
      summary: 'Create education entry',
      operationId: 'adminCreateEducation',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'institution'],
              properties: {
                title: { type: 'string' },
                institution: { type: 'string' },
                description: { type: 'string' },
                location: { type: 'string' },
                educationType: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                isCurrent: { type: 'boolean' },
                workloadHours: { type: 'integer' },
                credentialId: { type: 'string' },
                credentialUrl: { type: 'string' },
                order: { type: 'integer' },
                status: { type: 'string', enum: ['draft', 'published'] },
                logoUrl: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Education entry created' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '409': { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/admin/education/{id}': {
    get: {
      tags: ['Admin - Education'],
      summary: 'Get education entry by ID (admin)',
      operationId: 'adminGetEducation',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': { description: 'Education detail' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Admin - Education'],
      summary: 'Update education entry',
      operationId: 'adminUpdateEducation',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Education' },
          },
        },
      },
      responses: {
        '200': { description: 'Education updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Admin - Education'],
      summary: 'Soft delete education entry',
      operationId: 'adminDeleteEducation',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '204': { description: 'Deleted' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  // ── Admin Jobs ───────────────────────────────────────────────────────────────
  '/admin/jobs/dlq': {
    get: {
      tags: ['Admin - Jobs'],
      summary: 'Dead letter queue counts',
      operationId: 'adminJobsDlq',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Failed job counts per DLQ queue',
          content: {
            'application/json': {
              example: {
                success: true,
                data: { 'telegram-notifications-dlq': 0, 'image-optimize-dlq': 0 },
              },
            },
          },
        },
      },
    },
  },
} as const;
