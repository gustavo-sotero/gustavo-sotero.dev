import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../../config/env';

/**
 * Lazily-initialised OpenAI provider instance.
 *
 * Called only when the AI feature is enabled — never constructed during module
 * evaluation so the app boots cleanly even when OPENAI_API_KEY is absent and
 * AI_POSTS_ENABLED=false.
 */
let _openai: ReturnType<typeof createOpenAI> | null = null;

export function getOpenAiProvider(): ReturnType<typeof createOpenAI> {
  if (!_openai) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when AI_POSTS_ENABLED=true');
    }
    _openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _openai;
}
