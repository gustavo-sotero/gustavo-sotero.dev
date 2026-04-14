import { generateObject, NoObjectGeneratedError } from 'ai';
import type { ZodSchema } from 'zod';
import { env } from '../../config/env';
import { getLogger } from '../../config/logger';
import { getOpenRouterProvider } from './provider';

const logger = getLogger('ai', 'generate');

export interface GenerateStructuredObjectOptions<TSchema extends ZodSchema> {
  /** Model identifier (e.g. 'gpt-4o-mini') */
  model: string;
  /** System prompt */
  system: string;
  /** User prompt */
  prompt: string;
  /** Zod schema for structured output validation */
  schema: TSchema;
  /** Operation name for logging */
  operation: string;
  /** Extra structured fields to include in logs */
  metadata?: Record<string, unknown>;
}

export interface GenerateStructuredObjectResult<T> {
  object: T;
  durationMs: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

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
  const { model: modelId, system, prompt, schema, operation, metadata } = options;
  const openrouter = getOpenRouterProvider();
  const start = Date.now();
  const inputSizeApprox = system.length + prompt.length;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), env.AI_POSTS_TIMEOUT_MS);

  try {
    const result = await generateObject({
      model: openrouter(modelId, { provider: { require_parameters: true } }),
      schema,
      system,
      prompt,
      abortSignal: abortController.signal,
    });

    const durationMs = Date.now() - start;
    const inputTokens = result.usage?.inputTokens;
    const outputTokens = result.usage?.outputTokens;

    logger.info('AI generation succeeded', {
      operation,
      model: modelId,
      durationMs,
      success: true,
      timeout: false,
      refusal: false,
      validationFailure: false,
      inputSizeApprox,
      outputSizeApprox: approximateSize(result.object),
      inputTokens,
      outputTokens,
      ...metadata,
    });

    return {
      object: result.object as import('zod').infer<TSchema>,
      durationMs,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    const durationMs = Date.now() - start;

    if (abortController.signal.aborted) {
      logger.warn('AI generation timeout', {
        operation,
        model: modelId,
        durationMs,
        success: false,
        timeout: true,
        refusal: false,
        validationFailure: false,
        inputSizeApprox,
        ...metadata,
      });
      throw new AiGenerationError('timeout', 'AI provider timed out');
    }

    if (NoObjectGeneratedError.isInstance(err)) {
      const responseMetadata = err.response as { finishReason?: unknown } | undefined;
      const finishReason =
        typeof responseMetadata?.finishReason === 'string'
          ? responseMetadata.finishReason
          : 'unknown';
      const isRefusal = finishReason === 'content-filter';

      logger.warn('AI generation returned no structured object', {
        operation,
        model: modelId,
        durationMs,
        success: false,
        timeout: false,
        refusal: isRefusal,
        validationFailure: !isRefusal,
        finishReason,
        inputSizeApprox,
        outputSizeApprox: err.text?.length ?? 0,
        inputTokens: err.usage?.inputTokens,
        outputTokens: err.usage?.outputTokens,
        ...metadata,
      });

      throw new AiGenerationError(
        isRefusal ? 'refusal' : 'validation',
        isRefusal ? 'AI provider refused the request' : 'AI provider returned no valid object'
      );
    }

    logger.error('AI generation failed', {
      operation,
      model: modelId,
      durationMs,
      success: false,
      timeout: false,
      refusal: false,
      validationFailure: false,
      inputSizeApprox,
      error: (err as Error).message,
      ...metadata,
    });

    throw new AiGenerationError('provider', (err as Error).message ?? 'Unknown AI provider error');
  } finally {
    clearTimeout(timeoutId);
  }
}

function approximateSize(value: unknown): number | undefined {
  try {
    return JSON.stringify(value).length;
  } catch {
    return undefined;
  }
}

// ── Typed error class ─────────────────────────────────────────────────────────

export type AiGenerationErrorKind =
  | 'timeout'
  | 'refusal'
  | 'provider'
  | 'validation'
  | 'disabled'
  | 'not-configured'
  | 'invalid-config'
  | 'catalog-unavailable';

export class AiGenerationError extends Error {
  readonly kind: AiGenerationErrorKind;

  constructor(kind: AiGenerationErrorKind, message: string) {
    super(message);
    this.name = 'AiGenerationError';
    this.kind = kind;
  }
}
