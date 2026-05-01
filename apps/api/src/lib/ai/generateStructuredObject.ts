import {
  type GenerateStructuredObjectOptions,
  type GenerateStructuredObjectResult,
  generateStructuredObjectWithRuntime,
} from '@portfolio/shared/lib/ai-structured-object-generation';
import type { ZodSchema } from 'zod';
import { env } from '../../config/env';
import { getLogger } from '../../config/logger';
import { getOpenRouterProvider } from './provider';

export type {
  GenerateStructuredObjectOptions,
  GenerateStructuredObjectResult,
} from '@portfolio/shared/lib/ai-structured-object-generation';
export { AiGenerationError } from '@portfolio/shared/lib/ai-structured-object-generation';

const logger = getLogger('ai', 'generate');

/**
 * Wraps the AI SDK `generateObject` call with:
 *  - configurable timeout from env
 *  - structured logging (operation, model, duration, token usage, errors)
 *  - explicit refusal handling
 *  - normalised error surface: always throws an Error with a clear message
 */
export async function generateStructuredObject<TSchema extends ZodSchema>(
  options: GenerateStructuredObjectOptions<TSchema>
): Promise<GenerateStructuredObjectResult<import('zod').infer<TSchema>>> {
  const openrouter = getOpenRouterProvider();

  return generateStructuredObjectWithRuntime({
    ...options,
    timeoutMs: options.timeoutMs ?? env.AI_POSTS_TIMEOUT_MS,
    logger,
    createModel: (modelId, providerOptions) => openrouter(modelId, { provider: providerOptions }),
  });
}
