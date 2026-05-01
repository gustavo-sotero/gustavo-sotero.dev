import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { AiGenerationError } from '@portfolio/shared/lib/ai-error';
import { env } from '../../config/env';

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;

/**
 * Returns a lazily-initialised OpenRouter provider for the worker.
 * Throws if OPENROUTER_API_KEY is not set.
 */
export function getOpenRouterProvider(): ReturnType<typeof createOpenRouter> {
  if (!_openrouter) {
    if (!env.OPENROUTER_API_KEY) {
      throw new AiGenerationError(
        'not-configured',
        'OPENROUTER_API_KEY is required in the worker environment for AI generation jobs'
      );
    }
    _openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  }
  return _openrouter;
}
