import { z } from 'zod';

/**
 * Zod schema for the raw OpenRouter GET /api/v1/models response.
 *
 * Only the fields consumed by this application are parsed. Extra fields from
 * the upstream payload are stripped by Zod's default behaviour.
 *
 * Reference: https://openrouter.ai/docs/api-reference/list-available-models
 */

const openRouterModelPricingSchema = z.object({
  prompt: z.string().nullish(),
  completion: z.string().nullish(),
});

const openRouterModelTopProviderSchema = z
  .object({
    max_completion_tokens: z.number().int().positive().nullish(),
  })
  .nullish();

const openRouterModelArchitectureSchema = z
  .object({
    input_modalities: z.array(z.string()).nullish(),
    output_modalities: z.array(z.string()).nullish(),
    // Older API shape also has a top-level `modality` string
    modality: z.string().nullish(),
  })
  .nullish();

export const openRouterRawModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(''),
  description: z.string().nullish(),
  created: z.number().nullish(),
  context_length: z.number().int().positive().nullish(),
  expiration_date: z.string().nullish(),
  supported_parameters: z.array(z.string()).nullish(),
  pricing: openRouterModelPricingSchema.nullish(),
  top_provider: openRouterModelTopProviderSchema,
  architecture: openRouterModelArchitectureSchema,
});

export type OpenRouterRawModel = z.infer<typeof openRouterRawModelSchema>;

export const openRouterModelsResponseSchema = z.object({
  data: z.array(openRouterRawModelSchema),
});

export type OpenRouterModelsResponse = z.infer<typeof openRouterModelsResponseSchema>;
