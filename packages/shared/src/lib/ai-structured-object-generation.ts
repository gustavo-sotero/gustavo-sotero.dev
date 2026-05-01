import { generateObject, jsonSchema, NoObjectGeneratedError } from 'ai';
import type { ZodSchema } from 'zod';
import type { ProviderRoutingConfig } from '../schemas/ai-post-generation-config';
import { toOpenRouterProviderRouting } from '../schemas/ai-post-generation-config';
import { AiGenerationError } from './ai-error';
import { toOpenAiCompatibleStructuredOutputJsonSchema } from './ai-structured-outputs';
import { extractProviderGenerationId } from './aiProviderGeneration';

type GenerateObjectModel = Parameters<typeof generateObject>[0]['model'];

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

export interface StructuredObjectGenerationLogger {
  info(message: string, data: Record<string, unknown>): void;
  warn(message: string, data: Record<string, unknown>): void;
  error(message: string, data: Record<string, unknown>): void;
}

export interface GenerateStructuredObjectRuntimeOptions<TSchema extends ZodSchema>
  extends GenerateStructuredObjectOptions<TSchema> {
  timeoutMs: number;
  logger: StructuredObjectGenerationLogger;
  createModel: (modelId: string, providerOptions: Record<string, unknown>) => GenerateObjectModel;
}

export async function generateStructuredObjectWithRuntime<TSchema extends ZodSchema>(
  options: GenerateStructuredObjectRuntimeOptions<TSchema>
): Promise<GenerateStructuredObjectResult<import('zod').infer<TSchema>>> {
  const {
    model: modelId,
    system,
    prompt,
    schema: zodSchema,
    operation,
    metadata,
    providerRouting,
    timeoutMs,
    maxRetries = 0,
    logger,
    createModel,
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
    const result = await generateObject({
      model: createModel(modelId, providerOptions),
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
      const noObjectError = err as {
        response?: { finishReason?: unknown };
        text?: string;
        usage?: { inputTokens?: number; outputTokens?: number };
      };
      const responseMetadata = noObjectError.response;
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
        outputSizeApprox: noObjectError.text?.length ?? 0,
        inputTokens: noObjectError.usage?.inputTokens,
        outputTokens: noObjectError.usage?.outputTokens,
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
        inputSizeApprox,
        errorKind: err.kind,
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
      validate: (value: unknown) => {
        const parsed = schema.safeParse(value);

        if (parsed.success) {
          return { success: true as const, value: parsed.data };
        }

        return { success: false as const, error: parsed.error };
      },
    }
  );
}

export { AiGenerationError };
