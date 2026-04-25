import {
  AI_POST_CATEGORIES,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_BRIEFING_CHARS,
  AI_POST_MAX_EXCLUDED_ITEMS,
  AI_POST_MAX_EXCLUDED_TEXT_CHARS,
  AI_POST_MAX_SUGGESTIONS,
  AI_POST_MAX_TOPIC_TAG_NAMES,
  AI_POST_MIN_SUGGESTIONS,
  AI_POST_REQUESTED_CATEGORIES,
} from '@portfolio/shared';

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
                order: {
                  type: 'integer',
                  default: 0,
                  description: 'Admin-defined manual ordering rank (lower = higher priority).',
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
                order: {
                  type: 'integer',
                  description: 'Admin-defined manual ordering rank (lower = higher priority).',
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
  '/admin/posts/generate/config': {
    get: {
      tags: ['Admin - Posts'],
      summary: 'Get AI post generation config state',
      description:
        'Returns the current feature state and active model configuration for AI post generation.',
      operationId: 'adminGetAiPostGenerationConfig',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Current config state',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  featureEnabled: true,
                  status: 'ready',
                  config: {
                    topicsModelId: 'anthropic/claude-sonnet-4-5',
                    draftModelId: 'openai/gpt-4o',
                    topicsRouting: {
                      mode: 'low-latency',
                      preferredMaxLatencySeconds: 10,
                    },
                    draftRouting: {
                      mode: 'manual',
                      providerOrder: ['openai', 'anthropic'],
                      allowFallbacks: true,
                      sort: 'throughput',
                    },
                  },
                  issues: [],
                  updatedAt: '2026-04-14T12:00:00.000Z',
                  updatedBy: '12345678',
                  catalogFetchedAt: '2026-04-14T12:00:00.000Z',
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    put: {
      tags: ['Admin - Posts'],
      summary: 'Save AI post generation config',
      description:
        'Validates and persists the active model pair plus optional provider routing preferences for AI post generation. Both models must support structured_outputs in the OpenRouter catalog.',
      operationId: 'adminSaveAiPostGenerationConfig',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['topicsModelId', 'draftModelId'],
              properties: {
                topicsModelId: {
                  type: 'string',
                  description: 'OpenRouter model ID for topic generation.',
                  example: 'anthropic/claude-sonnet-4-5',
                },
                draftModelId: {
                  type: 'string',
                  description: 'OpenRouter model ID for draft generation.',
                  example: 'openai/gpt-4o',
                },
                topicsRouting: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    mode: {
                      type: 'string',
                      enum: ['balanced', 'low-latency', 'manual'],
                    },
                    providerOrder: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    allowFallbacks: {
                      type: 'boolean',
                    },
                    sort: {
                      type: 'string',
                      enum: ['price', 'latency', 'throughput'],
                    },
                    preferredMaxLatencySeconds: {
                      type: 'integer',
                      minimum: 1,
                    },
                    preferredMinThroughput: {
                      type: 'integer',
                      minimum: 1,
                    },
                    onlyProviders: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    ignoreProviders: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
                draftRouting: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    mode: {
                      type: 'string',
                      enum: ['balanced', 'low-latency', 'manual'],
                    },
                    providerOrder: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    allowFallbacks: {
                      type: 'boolean',
                    },
                    sort: {
                      type: 'string',
                      enum: ['price', 'latency', 'throughput'],
                    },
                    preferredMaxLatencySeconds: {
                      type: 'integer',
                      minimum: 1,
                    },
                    preferredMinThroughput: {
                      type: 'integer',
                      minimum: 1,
                    },
                    onlyProviders: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    ignoreProviders: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
            example: {
              topicsModelId: 'anthropic/claude-sonnet-4-5',
              draftModelId: 'openai/gpt-4o',
              topicsRouting: {
                mode: 'low-latency',
                preferredMaxLatencySeconds: 10,
              },
              draftRouting: {
                mode: 'manual',
                providerOrder: ['openai', 'anthropic'],
                allowFallbacks: true,
                sort: 'throughput',
                onlyProviders: ['openai', 'anthropic'],
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Config saved and validated',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  featureEnabled: true,
                  status: 'ready',
                  config: {
                    topicsModelId: 'anthropic/claude-sonnet-4-5',
                    draftModelId: 'openai/gpt-4o',
                    topicsRouting: {
                      mode: 'low-latency',
                      preferredMaxLatencySeconds: 10,
                    },
                    draftRouting: {
                      mode: 'manual',
                      providerOrder: ['openai', 'anthropic'],
                      allowFallbacks: true,
                      sort: 'throughput',
                    },
                  },
                  issues: [],
                  updatedAt: '2026-04-14T12:00:00.000Z',
                  updatedBy: '12345678',
                  catalogFetchedAt: '2026-04-14T12:00:00.000Z',
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '503': { description: 'Catalog unavailable or feature disabled' },
      },
    },
  },
  '/admin/posts/generate/models': {
    get: {
      tags: ['Admin - Posts'],
      summary: 'List eligible AI models',
      description:
        'Returns a paginated, searchable list of OpenRouter models that support structured_outputs and are eligible for AI post generation.',
      operationId: 'adminListAiPostGenerationModels',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        {
          name: 'q',
          in: 'query',
          schema: { type: 'string', maxLength: 100 },
          description: 'Search by model ID, name, or description.',
        },
        {
          name: 'forceRefresh',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Bypass the server-side catalog cache.',
        },
      ],
      responses: {
        '200': {
          description: 'Paginated eligible model list',
          content: {
            'application/json': {
              example: {
                success: true,
                data: [
                  {
                    id: 'anthropic/claude-sonnet-4-5',
                    providerFamily: 'anthropic',
                    name: 'Claude Sonnet 4.5',
                    description: 'Balanced intelligence and speed from Anthropic.',
                    contextLength: 200000,
                    maxCompletionTokens: 8096,
                    inputPrice: '0.000003',
                    outputPrice: '0.000015',
                    supportsStructuredOutputs: true,
                    expirationDate: null,
                    isDeprecated: false,
                  },
                ],
                meta: { page: 1, perPage: 20, total: 42, totalPages: 3 },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '503': { description: 'OpenRouter catalog unavailable' },
      },
    },
  },
  '/admin/posts/generate/topics': {
    post: {
      tags: ['Admin - Posts'],
      summary: 'Generate AI topic suggestions',
      description:
        'Generates 3-5 structured topic suggestions for a new post. Admin-only, CSRF-protected, ephemeral, and rate limited to 10 requests per minute.',
      operationId: 'adminGeneratePostTopics',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['category'],
              properties: {
                category: {
                  type: 'string',
                  enum: [...AI_POST_REQUESTED_CATEGORIES],
                  description:
                    "Editorial category that orients the AI prompt. Use 'misto' to request suggestions from any category.",
                  example: 'dados-filas-consistencia',
                },
                briefing: {
                  type: 'string',
                  nullable: true,
                  maxLength: AI_POST_MAX_BRIEFING_CHARS,
                  description: 'Optional short briefing with angle, target reader, or constraints.',
                  example:
                    'Foco em trade-offs reais de filas em produção; evitar tutorial introdutório.',
                },
                limit: {
                  type: 'integer',
                  minimum: AI_POST_MIN_SUGGESTIONS,
                  maximum: AI_POST_MAX_SUGGESTIONS,
                  default: AI_POST_DEFAULT_SUGGESTIONS,
                  description: 'Number of topic suggestions to generate.',
                },
                excludedIdeas: {
                  type: 'array',
                  maxItems: AI_POST_MAX_EXCLUDED_ITEMS,
                  description: 'Previously rejected ideas to avoid repeating the same angle.',
                  items: {
                    type: 'string',
                    maxLength: AI_POST_MAX_EXCLUDED_TEXT_CHARS,
                  },
                  default: [],
                  example: ['Introdução a filas', 'O que é Redis'],
                },
              },
            },
            example: {
              category: 'dados-filas-consistencia',
              briefing:
                'Foco em trade-offs reais de filas em produção; evitar tutorial introdutório.',
              limit: AI_POST_DEFAULT_SUGGESTIONS,
              excludedIdeas: ['Introdução a filas', 'O que é Redis'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Structured topic suggestions generated successfully',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  suggestions: [
                    {
                      suggestionId: 'queue-tradeoffs-1',
                      category: 'dados-filas-consistencia',
                      proposedTitle: 'Fila não é solução mágica — é troca',
                      angle:
                        'Quando uma fila reduz latência de verdade e quando ela só empurra complexidade para depois',
                      summary:
                        'Mostra o custo operacional de retries, DLQ e consistência eventual versus um fluxo síncrono mais simples.',
                      targetReader: 'Engenheiros backend que já usam Redis ou BullMQ em produção',
                      suggestedTagNames: ['BullMQ', 'Redis', 'Arquitetura'],
                      rationale:
                        'Tema técnico, específico e alinhado ao tom editorial do portfólio.',
                    },
                    {
                      suggestionId: 'idempotencia-2',
                      category: 'dados-filas-consistencia',
                      proposedTitle:
                        'Idempotência não é detalhe quando seu job pode rodar duas vezes',
                      angle:
                        'Como evitar efeitos colaterais duplicados em filas e integrações com retry automático',
                      summary:
                        'Discute deduplicação, chaves naturais e limites do retry cego em pipelines assíncronos.',
                      targetReader:
                        'Desenvolvedores lidando com workers, webhooks e reprocessamento',
                      suggestedTagNames: ['Idempotência', 'BullMQ', 'PostgreSQL'],
                      rationale:
                        'Conecta consistência eventual com um problema prático de produção.',
                    },
                    {
                      suggestionId: 'outbox-3',
                      category: 'dados-filas-consistencia',
                      proposedTitle:
                        'Outbox pattern só vale o custo quando a inconsistência dói de verdade',
                      angle:
                        'Quando transação local + publicação assíncrona compensa a complexidade adicional',
                      summary:
                        'Compara outbox contra abordagens mais simples e mostra o ponto em que o padrão passa a fazer sentido.',
                      targetReader:
                        'Engenheiros backend avaliando garantias de entrega entre banco e fila',
                      suggestedTagNames: ['Outbox', 'Transações', 'Consistência'],
                      rationale: 'Explora trade-off de arquitetura em vez de evangelizar padrão.',
                    },
                  ],
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '429': { $ref: '#/components/responses/RateLimited' },
        '503': {
          description:
            'AI provider unavailable, incomplete response, refusal, timeout, or feature disabled',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'A geração de posts com IA não está habilitada nesta instância.',
                },
              },
            },
          },
        },
      },
    },
  },
  '/admin/posts/generate/draft': {
    post: {
      tags: ['Admin - Posts'],
      summary: 'Generate AI post draft (synchronous, legacy)',
      description:
        'Generates a full editorial draft synchronously. Kept for compatibility. Prefer POST /admin/posts/generate/draft-runs for production use. Admin-only, CSRF-protected, rate limited to 5 requests per minute.',
      operationId: 'adminGeneratePostDraft',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['category', 'selectedSuggestion'],
              properties: {
                category: {
                  type: 'string',
                  enum: [...AI_POST_REQUESTED_CATEGORIES],
                  description:
                    "Category originally requested (may be 'misto' when topics came from mixed generation).",
                  example: 'dados-filas-consistencia',
                },
                briefing: {
                  type: 'string',
                  nullable: true,
                  maxLength: AI_POST_MAX_BRIEFING_CHARS,
                  description: 'Optional extra briefing from the admin.',
                  example: 'Manter tom técnico, direto e sem tutorial básico.',
                },
                selectedSuggestion: {
                  type: 'object',
                  required: [
                    'suggestionId',
                    'category',
                    'proposedTitle',
                    'angle',
                    'summary',
                    'targetReader',
                    'suggestedTagNames',
                    'rationale',
                  ],
                  properties: {
                    suggestionId: { type: 'string', example: 'queue-tradeoffs-1' },
                    category: {
                      type: 'string',
                      enum: [...AI_POST_CATEGORIES],
                      example: 'dados-filas-consistencia',
                    },
                    proposedTitle: {
                      type: 'string',
                      example: 'Fila não é solução mágica — é troca',
                    },
                    angle: {
                      type: 'string',
                      example:
                        'Quando uma fila reduz latência de verdade e quando ela só empurra complexidade para depois',
                    },
                    summary: {
                      type: 'string',
                      example:
                        'Mostra o custo operacional de retries, DLQ e consistência eventual versus um fluxo síncrono mais simples.',
                    },
                    targetReader: {
                      type: 'string',
                      example: 'Engenheiros backend que já usam Redis ou BullMQ em produção',
                    },
                    suggestedTagNames: {
                      type: 'array',
                      maxItems: AI_POST_MAX_TOPIC_TAG_NAMES,
                      items: { type: 'string' },
                      example: ['BullMQ', 'Redis', 'Arquitetura'],
                    },
                    rationale: {
                      type: 'string',
                      example: 'Tema técnico, específico e alinhado ao tom editorial do portfólio.',
                    },
                  },
                },
                rejectedAngles: {
                  type: 'array',
                  maxItems: AI_POST_MAX_EXCLUDED_ITEMS,
                  description: 'Angles rejected in previous draft attempts for the same topic.',
                  items: {
                    type: 'string',
                    maxLength: AI_POST_MAX_EXCLUDED_TEXT_CHARS,
                  },
                  default: [],
                  example: [
                    'Abordagem focada só em performance sem falar de complexidade operacional',
                  ],
                },
              },
            },
            example: {
              category: 'dados-filas-consistencia',
              briefing: 'Manter tom técnico, direto e sem tutorial básico.',
              selectedSuggestion: {
                suggestionId: 'queue-tradeoffs-1',
                category: 'dados-filas-consistencia',
                proposedTitle: 'Fila não é solução mágica — é troca',
                angle:
                  'Quando uma fila reduz latência de verdade e quando ela só empurra complexidade para depois',
                summary:
                  'Mostra o custo operacional de retries, DLQ e consistência eventual versus um fluxo síncrono mais simples.',
                targetReader: 'Engenheiros backend que já usam Redis ou BullMQ em produção',
                suggestedTagNames: ['BullMQ', 'Redis', 'Arquitetura'],
                rationale: 'Tema técnico, específico e alinhado ao tom editorial do portfólio.',
              },
              rejectedAngles: [
                'Abordagem focada só em performance sem falar de complexidade operacional',
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Structured post draft generated successfully',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  title: 'Fila não é solução mágica — é troca',
                  slug: 'fila-nao-e-solucao-magica-e-troca',
                  excerpt:
                    'Você coloca algo numa fila porque não quer pagar o custo agora. O custo não some; ele migra para operação, latência eventual e consistência.',
                  content:
                    "## O custo não desaparece\n\nQuando você empurra trabalho para uma fila, troca simplicidade síncrona por complexidade operacional.\n\n## Quando faz sentido\n\nUse fila quando o tempo de resposta ao usuário realmente importa e o processamento pode ser refeito com segurança.\n\n```typescript\nawait queue.add('send-email', payload);\n```",
                  suggestedTagNames: ['BullMQ', 'Redis', 'Arquitetura', 'Consistência'],
                  imagePrompt:
                    'Ilustração simples, minimalista e elegante em fundo escuro representando filas assíncronas e trade-offs, estética técnica em flat design, composição para thumb em formato 1:1 ou 4:3, com texto opcional apenas se reforçar a ideia central.',
                  linkedinPost:
                    'Filas não eliminam complexidade — elas a redistribuem. Antes de adicionar BullMQ ao stack, vale perguntar: o processamento síncrono realmente não resolve?\n\nNovo post no blog: https://gustavo-sotero.dev/blog/fila-nao-e-solucao-magica-e-troca\n\n#BullMQ #Redis #Arquitetura #BackendDev',
                  notes:
                    'Validar se o exemplo de código deve mencionar DLQ explicitamente para o público-alvo.',
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '429': { $ref: '#/components/responses/RateLimited' },
        '503': {
          description:
            'AI provider unavailable, incomplete response, refusal, timeout, or feature disabled',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'A IA gerou uma resposta incompleta. Tente novamente.',
                },
              },
            },
          },
        },
      },
    },
  },

  // ── Async Draft Runs ─────────────────────────────────────────────────────────
  '/admin/posts/generate/draft-runs': {
    post: {
      tags: ['Admin - Posts'],
      summary: 'Create async AI post draft run',
      description:
        'Enqueues an async draft generation run. Returns immediately with a run ID and recommended poll interval. Poll GET /admin/posts/generate/draft-runs/:id until status is `completed` or terminal. Admin-only, CSRF-protected, rate limited to 5 requests per minute.',
      operationId: 'adminCreatePostDraftRun',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['category', 'selectedSuggestion'],
              properties: {
                category: {
                  type: 'string',
                  enum: [...AI_POST_REQUESTED_CATEGORIES],
                  description:
                    "Editorial category originally requested. Use 'misto' when topics came from mixed generation.",
                  example: 'misto',
                },
                selectedSuggestion: {
                  type: 'object',
                  required: [
                    'suggestionId',
                    'category',
                    'proposedTitle',
                    'angle',
                    'summary',
                    'targetReader',
                    'suggestedTagNames',
                    'rationale',
                  ],
                  description: 'The topic suggestion selected by the admin.',
                  properties: {
                    suggestionId: { type: 'string', example: 'topic-01' },
                    proposedTitle: {
                      type: 'string',
                      example: 'Filas vs. Chamadas Síncronas',
                    },
                    angle: {
                      type: 'string',
                      example:
                        'Quando usar BullMQ e quando uma chamada HTTP direta resolve melhor.',
                    },
                    summary: {
                      type: 'string',
                      example: 'Um recorte prático sobre latência, acoplamento e resiliência.',
                    },
                    targetReader: {
                      type: 'string',
                      example: 'Engenheiros backend que operam workloads em produção.',
                    },
                    category: {
                      type: 'string',
                      enum: [...AI_POST_CATEGORIES],
                      description: 'Concrete category resolved from the topic suggestion.',
                      example: 'dados-filas-consistencia',
                    },
                    suggestedTagNames: {
                      type: 'array',
                      maxItems: AI_POST_MAX_TOPIC_TAG_NAMES,
                      items: { type: 'string' },
                      example: ['BullMQ', 'Redis', 'Node.js'],
                    },
                    rationale: {
                      type: 'string',
                      example: 'Tema forte para demonstrar trade-offs arquiteturais reais.',
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Run accepted and queued.',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  runId: 'c7d3f1a0-1234-4abc-9def-000000000001',
                  status: 'queued',
                  stage: 'queued',
                  pollAfterMs: 1000,
                  createdAt: '2026-04-14T12:00:00.000Z',
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error.',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Campo obrigatório ausente.',
                  details: [{ field: 'selectedSuggestion.title', message: 'Required' }],
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        503: {
          description: 'Feature disabled, model not configured, or provider unavailable.',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message:
                    'A geração de posts com IA não está configurada. Configure os modelos na página de configurações.',
                },
              },
            },
          },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/admin/posts/generate/draft-runs/{id}': {
    get: {
      tags: ['Admin - Posts'],
      summary: 'Get async draft run status',
      description:
        'Returns the current state of an async draft generation run. Poll this endpoint after creating a run until status is `completed`, `failed`, or `timed_out`. When `completed`, the `result` field contains the full draft.',
      operationId: 'adminGetPostDraftRunStatus',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Run ID returned by POST /admin/posts/generate/draft-runs.',
          example: 'c7d3f1a0-1234-4abc-9def-000000000001',
        },
      ],
      responses: {
        200: {
          description: 'Run state.',
          content: {
            'application/json': {
              examples: {
                running: {
                  summary: 'Run in progress',
                  value: {
                    success: true,
                    data: {
                      runId: 'c7d3f1a0-1234-4abc-9def-000000000001',
                      status: 'running',
                      stage: 'requesting-provider',
                      requestedCategory: 'misto',
                      selectedSuggestionCategory: 'dados-filas-consistencia',
                      concreteCategory: 'dados-filas-consistencia',
                      modelId: 'anthropic/claude-3-5-haiku',
                      attemptCount: 1,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: null,
                      durationMs: null,
                      error: null,
                      result: null,
                    },
                  },
                },
                completed: {
                  summary: 'Run completed successfully',
                  value: {
                    success: true,
                    data: {
                      runId: 'c7d3f1a0-1234-4abc-9def-000000000001',
                      status: 'completed',
                      stage: 'completed',
                      requestedCategory: 'misto',
                      selectedSuggestionCategory: 'dados-filas-consistencia',
                      concreteCategory: 'dados-filas-consistencia',
                      modelId: 'anthropic/claude-3-5-haiku',
                      attemptCount: 1,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: '2026-04-14T12:00:28.000Z',
                      durationMs: 27000,
                      error: null,
                      result: {
                        title: 'Filas vs. Chamadas Síncronas',
                        slug: 'filas-vs-chamadas-sincronas',
                        excerpt: 'Quando usar BullMQ e quando uma HTTP direta resolve melhor.',
                        content: '## Introdução\n...',
                        suggestedTagNames: ['BullMQ', 'Redis', 'Node.js'],
                        imagePrompt:
                          'Ilustra\u00e7\u00e3o simples, minimalista e elegante em fundo escuro representando filas ass\u00edncronas e chamadas diretas, est\u00e9tica t\u00e9cnica em flat design, composi\u00e7\u00e3o para thumb em formato 1:1 ou 4:3, com texto opcional apenas se refor\u00e7ar a ideia central.',
                        linkedinPost:
                          'Filas vs. chamadas s\u00edncronas \u2014 a escolha certa depende do tradeoff que voc\u00ea est\u00e1 disposto a aceitar.\n\nNovo post no blog: https://gustavo-sotero.dev/blog/filas-vs-chamadas-sincronas\n\n#BullMQ #Redis #Nodejs',
                        notes: null,
                      },
                    },
                  },
                },
                failed: {
                  summary: 'Run failed',
                  value: {
                    success: true,
                    data: {
                      runId: 'c7d3f1a0-1234-4abc-9def-000000000001',
                      status: 'failed',
                      stage: 'failed',
                      requestedCategory: 'misto',
                      selectedSuggestionCategory: 'dados-filas-consistencia',
                      concreteCategory: 'dados-filas-consistencia',
                      modelId: 'anthropic/claude-3-5-haiku',
                      attemptCount: 2,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: '2026-04-14T12:00:12.000Z',
                      durationMs: 11000,
                      error: {
                        kind: 'provider',
                        code: '503',
                        message: 'Provider unavailable after retries.',
                      },
                      result: null,
                    },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/admin/posts/generate/topic-runs': {
    post: {
      tags: ['Admin - Posts'],
      summary: 'Create async topic run',
      description:
        'Enqueues an async topic generation run. Returns immediately with a run ID and recommended poll interval. Poll GET /admin/posts/generate/topic-runs/:id until status is `completed` or terminal. Admin-only, CSRF-protected, rate limited to 10 requests per minute.',
      operationId: 'adminCreatePostTopicRun',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['category', 'excludedIdeas'],
              properties: {
                category: {
                  type: 'string',
                  enum: AI_POST_REQUESTED_CATEGORIES,
                  description: 'Editorial category for topic generation.',
                },
                briefing: {
                  type: 'string',
                  nullable: true,
                  maxLength: AI_POST_MAX_BRIEFING_CHARS,
                  description: 'Optional author guidance (angles, audience, constraints).',
                },
                limit: {
                  type: 'integer',
                  minimum: AI_POST_MIN_SUGGESTIONS,
                  maximum: AI_POST_MAX_SUGGESTIONS,
                  default: AI_POST_DEFAULT_SUGGESTIONS,
                  description: 'Number of topic suggestions to generate.',
                },
                excludedIdeas: {
                  type: 'array',
                  maxItems: AI_POST_MAX_EXCLUDED_ITEMS,
                  items: { type: 'string', maxLength: AI_POST_MAX_EXCLUDED_TEXT_CHARS },
                  description: 'Titles from previous generations to avoid.',
                },
              },
            },
            example: {
              category: 'backend-arquitetura',
              briefing: 'Foco em sistemas distribuídos e trade-offs de consistência.',
              limit: 4,
              excludedIdeas: ['Introdução ao Docker'],
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Topic run accepted.',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  runId: 'd9e2f3a0-5678-4bcd-aef0-000000000002',
                  status: 'queued',
                  stage: 'queued',
                  pollAfterMs: 1000,
                  createdAt: '2026-04-14T12:00:00.000Z',
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        503: {
          description: 'Feature disabled, model not configured, or provider unavailable.',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'A geração de posts com IA não está habilitada nesta instância.',
                },
              },
            },
          },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/admin/posts/generate/topic-runs/{id}': {
    get: {
      tags: ['Admin - Posts'],
      summary: 'Get async topic run status',
      description:
        'Returns the current state of an async topic generation run. Poll this endpoint after creating a run until status is `completed`, `failed`, or `timed_out`. When `completed`, the `result` field contains the full suggestions list.',
      operationId: 'adminGetPostTopicRunStatus',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Run ID returned by POST /admin/posts/generate/topic-runs.',
          example: 'd9e2f3a0-5678-4bcd-aef0-000000000002',
        },
      ],
      responses: {
        200: {
          description: 'Run state.',
          content: {
            'application/json': {
              examples: {
                running: {
                  summary: 'Run in progress',
                  value: {
                    success: true,
                    data: {
                      runId: 'd9e2f3a0-5678-4bcd-aef0-000000000002',
                      status: 'running',
                      stage: 'requesting-provider',
                      requestedCategory: 'backend-arquitetura',
                      modelId: 'openai/gpt-4o-mini',
                      attemptCount: 1,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: null,
                      durationMs: null,
                      error: null,
                      result: null,
                    },
                  },
                },
                completed: {
                  summary: 'Run completed successfully',
                  value: {
                    success: true,
                    data: {
                      runId: 'd9e2f3a0-5678-4bcd-aef0-000000000002',
                      status: 'completed',
                      stage: 'completed',
                      requestedCategory: 'backend-arquitetura',
                      modelId: 'openai/gpt-4o-mini',
                      attemptCount: 1,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: '2026-04-14T12:00:08.000Z',
                      durationMs: 7000,
                      error: null,
                      result: {
                        suggestions: [
                          {
                            suggestionId: 'abc1',
                            category: 'backend-arquitetura',
                            proposedTitle: 'Filas vs. Chamadas Síncronas',
                            angle: 'Trade-offs de acoplamento',
                            summary: 'Quando usar BullMQ e quando uma HTTP direta resolve melhor.',
                            targetReader: 'Engenheiro backend com 2-5 anos',
                            suggestedTagNames: ['BullMQ', 'Redis'],
                            rationale: 'Tema recorrente em PT-BR.',
                          },
                        ],
                      },
                    },
                  },
                },
                failed: {
                  summary: 'Run failed',
                  value: {
                    success: true,
                    data: {
                      runId: 'd9e2f3a0-5678-4bcd-aef0-000000000002',
                      status: 'failed',
                      stage: 'failed',
                      requestedCategory: 'backend-arquitetura',
                      modelId: 'openai/gpt-4o-mini',
                      attemptCount: 2,
                      createdAt: '2026-04-14T12:00:00.000Z',
                      startedAt: '2026-04-14T12:00:01.000Z',
                      finishedAt: '2026-04-14T12:00:12.000Z',
                      durationMs: 11000,
                      error: {
                        kind: 'provider',
                        code: '503',
                        message: 'Provider unavailable after retries.',
                      },
                      result: null,
                    },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
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
                impactFacts: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 200 },
                  maxItems: 6,
                  description:
                    'Ordered list of concise impact facts reused across portfolio and resume surfaces.',
                },
                skillIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Skill IDs. Every submitted ID must exist in the skills table.',
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
                impactFacts: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 200 },
                  maxItems: 6,
                  description:
                    'Ordered list of concise impact facts reused across portfolio and resume surfaces.',
                },
                skillIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Skill IDs. Every submitted ID must exist in the skills table.',
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
        '409': { description: 'Name conflict' },
      },
    },
  },
  '/admin/tags/resolve-ai-suggested': {
    post: {
      tags: ['Admin - Tags'],
      summary: 'Resolve AI-suggested tag names to persisted IDs',
      description:
        'Accepts a list of raw AI-suggested tag names. Each name is canonicalized and ' +
        'deduplicated. Existing tags are reused; missing tags are auto-created with the ' +
        'category inferred from the shared ICON_CATALOG (fallback: `other`). ' +
        'Only call this endpoint when the admin explicitly accepts a draft — never during ' +
        'generation or polling.',
      operationId: 'adminResolveAiSuggestedTags',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['names'],
              properties: {
                names: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 100 },
                  minItems: 1,
                  maxItems: 50,
                  description: 'Raw tag names as returned by the AI draft.',
                  example: ['Redis', 'BullMQ', 'typescript'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'List of resolved (existing or newly created) tags',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
              example: {
                success: true,
                data: [
                  {
                    id: 3,
                    name: 'Redis',
                    slug: 'redis',
                    category: 'db',
                    iconKey: 'si:SiRedis',
                    createdAt: '2026-04-24T00:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
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
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Tag updated' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Name conflict' },
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
                impactFacts: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 200 },
                  maxItems: 6,
                  description:
                    'Ordered list of concise impact facts reused across portfolio and resume surfaces.',
                },
                skillIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Skill IDs. Every submitted ID must exist in the skills table.',
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
                impactFacts: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 200 },
                  maxItems: 6,
                  description:
                    'Ordered list of concise impact facts reused across portfolio and resume surfaces.',
                },
                skillIds: {
                  type: 'array',
                  items: { type: 'integer' },
                  uniqueItems: true,
                  description: 'Skill IDs. Every submitted ID must exist in the skills table.',
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

  // ── Admin Skills ─────────────────────────────────────────────────────────────
  '/admin/skills': {
    get: {
      tags: ['Admin - Skills'],
      summary: 'List all skills',
      operationId: 'adminListSkills',
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/perPage' },
        {
          name: 'category',
          in: 'query',
          schema: { type: 'string', example: 'language,framework' },
          description: 'Comma-separated category filter',
        },
        {
          name: 'highlighted',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Filter to highlighted skills only',
        },
      ],
      responses: {
        '200': {
          description: 'Paginated skill list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Skill' } },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Admin - Skills'],
      summary: 'Create skill',
      description:
        'Creates a new skill. `iconKey` is always auto-assigned by the server icon resolver — do not send it.',
      operationId: 'adminCreateSkill',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'category'],
              properties: {
                name: { type: 'string', maxLength: 100, example: 'TypeScript' },
                category: {
                  type: 'string',
                  enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra'],
                },
                expertiseLevel: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 3,
                  default: 1,
                  description: '1 = familiar, 2 = proficient, 3 = expert',
                },
                isHighlighted: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Skill created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Skill' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '409': { description: 'Skill name already exists or highlight limit reached' },
      },
    },
  },
  '/admin/skills/{id}': {
    get: {
      tags: ['Admin - Skills'],
      summary: 'Get skill by ID',
      operationId: 'adminGetSkill',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': {
          description: 'Skill detail',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Skill' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Admin - Skills'],
      summary: 'Update skill',
      operationId: 'adminUpdateSkill',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', maxLength: 100 },
                category: {
                  type: 'string',
                  enum: ['language', 'framework', 'tool', 'db', 'cloud', 'infra'],
                },
                expertiseLevel: { type: 'integer', minimum: 1, maximum: 3 },
                isHighlighted: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Skill updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Skill' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { description: 'Skill name already exists or highlight limit reached' },
      },
    },
    delete: {
      tags: ['Admin - Skills'],
      summary: 'Delete skill',
      description:
        'Hard-deletes a skill. Cascade removes all project_skills and experience_skills rows.',
      operationId: 'adminDeleteSkill',
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
