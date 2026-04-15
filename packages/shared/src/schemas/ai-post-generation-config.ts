import { z } from 'zod';

// ── Provider routing config ───────────────────────────────────────────────────

/**
 * Subset of OpenRouter's provider routing options that can be persisted per
 * operation. All fields are optional — only the ones set are forwarded to the
 * provider when making a generation call.
 */
export const providerRoutingConfigSchema = z
  .object({
    order: z.array(z.string()).optional(),
    allow_fallbacks: z.boolean().optional(),
    sort: z.string().optional(),
    preferred_max_latency: z.number().int().positive().optional(),
    preferred_min_throughput: z.number().int().positive().optional(),
  })
  .nullable();

export type ProviderRoutingConfig = z.infer<typeof providerRoutingConfigSchema>;

// ── Config status ─────────────────────────────────────────────────────────────

export const aiPostGenerationStatusSchema = z.enum([
  'disabled',
  'not-configured',
  'ready',
  'invalid-config',
  'catalog-unavailable',
]);

export type AiPostGenerationStatus = z.infer<typeof aiPostGenerationStatusSchema>;

// ── Persisted config values ───────────────────────────────────────────────────

export const aiPostGenerationConfigSchema = z.object({
  topicsModelId: z.string().min(1),
  draftModelId: z.string().min(1),
  topicsRouting: providerRoutingConfigSchema.optional(),
  draftRouting: providerRoutingConfigSchema.optional(),
});

export type AiPostGenerationConfig = z.infer<typeof aiPostGenerationConfigSchema>;

// ── Config state (returned by GET /admin/posts/generate/config) ───────────────

export const aiPostGenerationConfigStateSchema = z.object({
  featureEnabled: z.boolean(),
  status: aiPostGenerationStatusSchema,
  config: aiPostGenerationConfigSchema.nullable(),
  issues: z.array(z.string()),
  updatedAt: z.string().datetime().nullable(),
  updatedBy: z.string().nullable(),
  catalogFetchedAt: z.string().datetime().nullable(),
});

export type AiPostGenerationConfigState = z.infer<typeof aiPostGenerationConfigStateSchema>;

// ── Config update request (PUT /admin/posts/generate/config) ─────────────────

export const updateAiPostGenerationConfigSchema = z.object({
  topicsModelId: z.string().min(1, 'Modelo para tópicos é obrigatório'),
  draftModelId: z.string().min(1, 'Modelo para rascunho é obrigatório'),
  topicsRouting: providerRoutingConfigSchema.optional(),
  draftRouting: providerRoutingConfigSchema.optional(),
});

export type UpdateAiPostGenerationConfig = z.infer<typeof updateAiPostGenerationConfigSchema>;

// ── Model catalog item (returned by GET /admin/posts/generate/models) ─────────

export const aiPostGenerationModelSummarySchema = z.object({
  id: z.string().min(1),
  providerFamily: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  contextLength: z.number().int().positive().nullable(),
  maxCompletionTokens: z.number().int().positive().nullable(),
  inputPrice: z.string().nullable(),
  outputPrice: z.string().nullable(),
  supportsStructuredOutputs: z.boolean(),
  expirationDate: z.string().datetime().nullable(),
  isDeprecated: z.boolean(),
});

export type AiPostGenerationModelSummary = z.infer<typeof aiPostGenerationModelSummarySchema>;

// ── Models query params ───────────────────────────────────────────────────────

export const aiPostGenerationModelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  forceRefresh: z.coerce.boolean().optional(),
});

export type AiPostGenerationModelsQuery = z.infer<typeof aiPostGenerationModelsQuerySchema>;
