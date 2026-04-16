import { z } from 'zod';

// ── Provider routing config ───────────────────────────────────────────────────

export const providerRoutingModeSchema = z.enum(['balanced', 'low-latency', 'manual']);
export type ProviderRoutingMode = z.infer<typeof providerRoutingModeSchema>;

export const providerRoutingSortSchema = z.enum(['price', 'latency', 'throughput']);
export type ProviderRoutingSort = z.infer<typeof providerRoutingSortSchema>;

export interface ProviderRoutingConfig {
  mode: ProviderRoutingMode;
  providerOrder?: string[];
  allowFallbacks?: boolean;
  sort?: ProviderRoutingSort;
  preferredMaxLatencySeconds?: number;
  preferredMinThroughput?: number;
  onlyProviders?: string[];
  ignoreProviders?: string[];
}

export interface OpenRouterProviderRoutingOptions {
  order?: string[];
  allow_fallbacks?: boolean;
  sort?: ProviderRoutingSort;
  preferred_max_latency?: number;
  preferred_min_throughput?: number;
  only?: string[];
  ignore?: string[];
}

const providerSlugListSchema = z.array(z.string()).optional();
const positiveIntegerSchema = z.number().int().positive();

const providerRoutingPublicInputSchema = z
  .object({
    mode: providerRoutingModeSchema.optional(),
    providerOrder: providerSlugListSchema,
    allowFallbacks: z.boolean().optional(),
    sort: providerRoutingSortSchema.optional(),
    preferredMaxLatencySeconds: positiveIntegerSchema.optional(),
    preferredMinThroughput: positiveIntegerSchema.optional(),
    onlyProviders: providerSlugListSchema,
    ignoreProviders: providerSlugListSchema,
  })
  .strict();

const providerRoutingLegacyInputSchema = z
  .object({
    order: providerSlugListSchema,
    allow_fallbacks: z.boolean().optional(),
    sort: providerRoutingSortSchema.optional(),
    preferred_max_latency: positiveIntegerSchema.optional(),
    preferred_min_throughput: positiveIntegerSchema.optional(),
    only: providerSlugListSchema,
    ignore: providerSlugListSchema,
  })
  .strict();

const providerRoutingNormalizedSchema = z
  .object({
    mode: providerRoutingModeSchema,
    providerOrder: providerSlugListSchema,
    allowFallbacks: z.boolean().optional(),
    sort: providerRoutingSortSchema.optional(),
    preferredMaxLatencySeconds: positiveIntegerSchema.optional(),
    preferredMinThroughput: positiveIntegerSchema.optional(),
    onlyProviders: providerSlugListSchema,
    ignoreProviders: providerSlugListSchema,
  })
  .superRefine((value, ctx) => {
    const overlappingProviders = value.onlyProviders?.filter((provider) =>
      value.ignoreProviders?.includes(provider)
    );

    if ((overlappingProviders?.length ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ignoreProviders'],
        message: 'Um provider não pode existir ao mesmo tempo em onlyProviders e ignoreProviders.',
      });
    }

    const hasManualPreference =
      (value.providerOrder?.length ?? 0) > 0 ||
      value.sort !== undefined ||
      value.preferredMaxLatencySeconds !== undefined ||
      value.preferredMinThroughput !== undefined ||
      (value.onlyProviders?.length ?? 0) > 0 ||
      (value.ignoreProviders?.length ?? 0) > 0 ||
      value.allowFallbacks === false;

    if (value.mode === 'manual' && !hasManualPreference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mode'],
        message: 'Modo manual exige ao menos uma preferência explícita de routing.',
      });
    }
  });

type ProviderRoutingConfigInput =
  | z.infer<typeof providerRoutingPublicInputSchema>
  | z.infer<typeof providerRoutingLegacyInputSchema>;

function isLegacyProviderRoutingInput(
  input: ProviderRoutingConfigInput
): input is z.infer<typeof providerRoutingLegacyInputSchema> {
  return (
    'order' in input ||
    'allow_fallbacks' in input ||
    'preferred_max_latency' in input ||
    'preferred_min_throughput' in input ||
    'only' in input ||
    'ignore' in input
  );
}

function normalizeProviderList(values?: string[]): string[] | undefined {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function inferProviderRoutingMode(
  config: Omit<ProviderRoutingConfig, 'mode'>
): ProviderRoutingMode {
  if (config.sort === 'latency' || config.preferredMaxLatencySeconds !== undefined) {
    return 'low-latency';
  }

  const hasManualPreference =
    (config.providerOrder?.length ?? 0) > 0 ||
    config.sort !== undefined ||
    config.preferredMaxLatencySeconds !== undefined ||
    config.preferredMinThroughput !== undefined ||
    (config.onlyProviders?.length ?? 0) > 0 ||
    (config.ignoreProviders?.length ?? 0) > 0 ||
    config.allowFallbacks === false;

  return hasManualPreference ? 'manual' : 'balanced';
}

function normalizeProviderRoutingValue(input: ProviderRoutingConfigInput): ProviderRoutingConfig {
  const normalizedConfig: Omit<ProviderRoutingConfig, 'mode'> = isLegacyProviderRoutingInput(input)
    ? {
        providerOrder: normalizeProviderList(input.order),
        allowFallbacks: input.allow_fallbacks,
        sort: input.sort,
        preferredMaxLatencySeconds: input.preferred_max_latency,
        preferredMinThroughput: input.preferred_min_throughput,
        onlyProviders: normalizeProviderList(input.only),
        ignoreProviders: normalizeProviderList(input.ignore),
      }
    : {
        providerOrder: normalizeProviderList(input.providerOrder),
        allowFallbacks: input.allowFallbacks,
        sort: input.sort,
        preferredMaxLatencySeconds: input.preferredMaxLatencySeconds,
        preferredMinThroughput: input.preferredMinThroughput,
        onlyProviders: normalizeProviderList(input.onlyProviders),
        ignoreProviders: normalizeProviderList(input.ignoreProviders),
      };

  return {
    ...normalizedConfig,
    mode: 'mode' in input && input.mode ? input.mode : inferProviderRoutingMode(normalizedConfig),
  };
}

function compactOpenRouterRouting(
  config: OpenRouterProviderRoutingOptions
): OpenRouterProviderRoutingOptions | undefined {
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Subset of OpenRouter's provider routing options that can be persisted per
 * operation. All fields are optional — only the ones set are forwarded to the
 * provider when making a generation call.
 */
export const providerRoutingConfigSchema: z.ZodType<ProviderRoutingConfig | null> = z
  .union([providerRoutingPublicInputSchema, providerRoutingLegacyInputSchema, z.null()])
  .transform((value) => (value === null ? null : normalizeProviderRoutingValue(value)))
  .pipe(providerRoutingNormalizedSchema.nullable());

export function toOpenRouterProviderRouting(
  providerRouting?: ProviderRoutingConfig | null
): OpenRouterProviderRoutingOptions | undefined {
  if (!providerRouting) {
    return undefined;
  }

  const normalized = providerRoutingConfigSchema.parse(providerRouting);
  if (!normalized) {
    return undefined;
  }

  const sort = normalized.sort ?? (normalized.mode === 'low-latency' ? 'latency' : undefined);

  return compactOpenRouterRouting({
    ...(normalized.providerOrder ? { order: normalized.providerOrder } : {}),
    ...(normalized.allowFallbacks !== undefined
      ? { allow_fallbacks: normalized.allowFallbacks }
      : {}),
    ...(sort ? { sort } : {}),
    ...(normalized.preferredMaxLatencySeconds !== undefined
      ? { preferred_max_latency: normalized.preferredMaxLatencySeconds }
      : {}),
    ...(normalized.preferredMinThroughput !== undefined
      ? { preferred_min_throughput: normalized.preferredMinThroughput }
      : {}),
    ...(normalized.onlyProviders ? { only: normalized.onlyProviders } : {}),
    ...(normalized.ignoreProviders ? { ignore: normalized.ignoreProviders } : {}),
  });
}

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
