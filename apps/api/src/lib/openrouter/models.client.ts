import { getLogger } from '../../config/logger';
import { type OpenRouterModelsResponse, openRouterModelsResponseSchema } from './models.schema';

const logger = getLogger('openrouter', 'models-client');

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch and Zod-validate the OpenRouter model catalog.
 *
 * Throws on network failure, HTTP error, or schema validation failure.
 * Callers are responsible for caching and error handling.
 */
export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModelsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const start = Date.now();

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://sotero.dev',
        'X-Title': 'Portfolio API',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenRouter models API returned HTTP ${res.status}`);
    }

    const raw = await res.json();
    const parsed = openRouterModelsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(
        `OpenRouter models response did not match expected schema: ${parsed.error.message}`
      );
    }

    const durationMs = Date.now() - start;
    logger.info('OpenRouter models catalog fetched', {
      operation: 'fetchOpenRouterModels',
      itemCount: parsed.data.data.length,
      durationMs,
      success: true,
    });

    return parsed.data;
  } catch (err) {
    const durationMs = Date.now() - start;
    const isTimeout = controller.signal.aborted;

    logger.warn('OpenRouter models catalog fetch failed', {
      operation: 'fetchOpenRouterModels',
      durationMs,
      success: false,
      timeout: isTimeout,
      error: (err as Error).message,
    });

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
