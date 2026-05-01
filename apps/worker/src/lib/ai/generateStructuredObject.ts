import {
  type GenerateStructuredObjectOptions,
  type GenerateStructuredObjectResult,
  generateStructuredObjectWithRuntime,
} from '@portfolio/shared/lib/ai-structured-object-generation';
import type { ZodSchema } from 'zod';
import { env } from '../../config/env';
import { getLogger } from '../../config/logger';
import { getOpenRouterProvider } from './provider';

const logger = getLogger('worker', 'ai', 'generate');

export type {
  GenerateStructuredObjectOptions,
  GenerateStructuredObjectResult,
} from '@portfolio/shared/lib/ai-structured-object-generation';
export { AiGenerationError } from '@portfolio/shared/lib/ai-structured-object-generation';

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
