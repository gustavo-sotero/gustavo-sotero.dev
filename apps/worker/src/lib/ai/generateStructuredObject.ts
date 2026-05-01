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

const logger = getLogger('worker', 'ai', 'generate');

export interface GenerateStructuredObjectOptions<TSchema extends ZodSchema> {
  model: string;
  system: string;
  prompt: string;
  schema: TSchema;
  operation: string;
  metadata?: Record<string, unknown>;
  providerRouting?: ProviderRoutingConfig;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface GenerateStructuredObjectResult<T> {
  object: T;
  durationMs: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  providerGenerationId: string | null;
}

export { AiGenerationError };

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
    const openrouter = getOpenRouterProvider();
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
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      providerGenerationId,
      ...metadata,
    });

    return {
      object: result.object as import('zod').infer<TSchema>,
      durationMs,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
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
        ...metadata,
      });

      throw new AiGenerationError(
        isRefusal ? 'refusal' : 'validation',
        isRefusal ? 'AI provider refused the request' : 'AI provider returned no valid object'
      );
    }

    if (err instanceof AiGenerationError) {
      logger.warn('AI generation blocked by typed configuration error', {
        operation,
        model: modelId,
        durationMs,
        success: false,
        timeout: false,
        refusal: false,
        validationFailure: false,
        errorKind: err.kind,
        inputSizeApprox,
        error: err.message,
        ...metadata,
      });
      throw err;
    }

    logger.error('AI generation failed', {
      operation,
      model: modelId,
      durationMs,
      success: false,
      inputSizeApprox,
      error: (err as Error).message,
      ...metadata,
    });

    throw new AiGenerationError('provider', (err as Error).message ?? 'Unknown AI provider error');
  } finally {
    clearTimeout(timeoutId);
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
