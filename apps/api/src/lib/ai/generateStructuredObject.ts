import {
  AiGenerationError,
  type ProviderRoutingConfig,
  toOpenAiCompatibleStructuredOutputJsonSchema,
  toOpenRouterProviderRouting,
} from '@portfolio/shared';
import { extractProviderGenerationId } from '@portfolio/shared/lib/aiProviderGeneration';
import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import type { ZodSchema } from 'zod';
import { env } from '../../config/env';
import { getLogger } from '../../config/logger';
import { getOpenRouterProvider } from './provider';

export { AiGenerationError } from '@portfolio/shared';

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
  /**
   * Optional OpenRouter provider routing options.
   * When provided, merged with `require_parameters: true` in the provider call.
   */
  providerRouting?: ProviderRoutingConfig;
  /** Explicit timeout budget for this operation. */
  timeoutMs?: number;
  /** Explicit SDK retry count for this operation. */
  maxRetries?: number;
}

export interface GenerateStructuredObjectResult<T> {
  object: T;
  durationMs: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  providerGenerationId: string | null;
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
  const {
    model: modelId,
    system,
    prompt,
    schema: zodSchema,
    operation,
    metadata,
    providerRouting,
    timeoutMs = env.AI_POSTS_TIMEOUT_MS,
    maxRetries = 0,
  } = options;
  const openrouter = getOpenRouterProvider();
  const start = Date.now();
  const inputSizeApprox = system.length + prompt.length;
  const structuredOutputSchema = buildStructuredOutputSchema(zodSchema);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  const providerOptions = {
    require_parameters: true,
    ...(toOpenRouterProviderRouting(providerRouting) ?? {}),
  };

  try {
    const result = await generateObject({
      model: openrouter(modelId, { provider: providerOptions }),
      schema: structuredOutputSchema,
      system,
      prompt,
      abortSignal: abortController.signal,
      timeout: timeoutMs,
      maxRetries,
    });

    const durationMs = Date.now() - start;
    const inputTokens = result.usage?.inputTokens;
    const outputTokens = result.usage?.outputTokens;
    const providerGenerationId = extractProviderGenerationId(result);

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
      providerGenerationId,
      ...metadata,
    });

    return {
      object: result.object as import('zod').infer<TSchema>,
      durationMs,
      inputTokens,
      outputTokens,
      providerGenerationId,
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

function buildStructuredOutputSchema<TSchema extends ZodSchema>(schema: TSchema) {
  return jsonSchema<import('zod').infer<TSchema>>(
    toOpenAiCompatibleStructuredOutputJsonSchema(schema),
    {
      validate: (value) => {
        const parsed = schema.safeParse(value);

        if (parsed.success) {
          return { success: true as const, value: parsed.data };
        }

        return { success: false as const, error: parsed.error };
      },
    }
  );
}

// AiGenerationError and AiGenerationErrorKind are now in @portfolio/shared.
// Re-exported at the top of this file for backward compatibility.
