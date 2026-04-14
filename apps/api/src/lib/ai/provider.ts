import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '../../config/env';

/**
 * Lazily-initialised OpenRouter provider instance.
 *
 * Called only when the AI feature is enabled — never constructed during module
 * evaluation so the app boots cleanly even when OPENROUTER_API_KEY is absent and
 * AI_POSTS_ENABLED=false.
 */
let _openrouter: ReturnType<typeof createOpenRouter> | null = null;

export function getOpenRouterProvider(): ReturnType<typeof createOpenRouter> {
  if (!_openrouter) {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true');
    }
    _openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  }
  return _openrouter;
}
