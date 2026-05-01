import type { ZodSchema } from 'zod';
import type {
  GenerateDraftRequest,
  GenerateDraftResponse,
  GenerateTopicsRequest,
  GenerateTopicsResponse,
} from '../schemas/ai-post-generation';
import {
  generateDraftOutputSchema,
  generateTopicsOutputSchema,
} from '../schemas/ai-post-generation';
import type { ProviderRoutingConfig } from '../schemas/ai-post-generation-config';
import { normalizeDraftResponse } from './ai-draft-normalizer';
import {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildTopicsSystemPrompt,
  buildTopicsUserPrompt,
} from './ai-post-prompts';
import type {
  GenerateStructuredObjectOptions,
  GenerateStructuredObjectResult,
} from './ai-structured-object-generation';
import { normalizeTopicsResponse } from './ai-topic-normalizer';
import type { PersistedTagForNormalization } from './aiTagNormalizer';

type StructuredObjectGenerator = <TSchema extends ZodSchema>(
  options: GenerateStructuredObjectOptions<TSchema>
) => Promise<GenerateStructuredObjectResult<import('zod').infer<TSchema>>>;

type Awaitable = Promise<void> | void;

interface GenerationLifecycle {
  onBuildingPrompt?: () => Awaitable;
  onRequestingProvider?: () => Awaitable;
  onNormalizingOutput?: () => Awaitable;
  onCanonicalizingTags?: () => Awaitable;
  onValidatingOutput?: () => Awaitable;
}

interface BaseExecutionOptions<TRequest> {
  model: string;
  request: TRequest;
  operation: string;
  metadata?: Record<string, unknown>;
  providerRouting?: ProviderRoutingConfig;
  timeoutMs: number;
  maxRetries?: number;
  generateStructuredObject: StructuredObjectGenerator;
  loadPersistedTags: () => Promise<PersistedTagForNormalization[]>;
  lifecycle?: GenerationLifecycle;
}

interface ExecutionResult<TResponse> {
  response: TResponse;
  result: GenerateStructuredObjectResult<TResponse>;
}

function rethrowWithProviderGenerationId(
  error: unknown,
  providerGenerationId: string | null
): never {
  if (error instanceof Error) {
    throw Object.assign(error, { providerGenerationId });
  }

  throw Object.assign(new Error(String(error)), { providerGenerationId });
}

export async function executeTopicsGeneration(
  options: BaseExecutionOptions<GenerateTopicsRequest>
): Promise<ExecutionResult<GenerateTopicsResponse>> {
  const {
    model,
    request,
    operation,
    metadata,
    providerRouting,
    timeoutMs,
    maxRetries,
    generateStructuredObject,
    loadPersistedTags,
    lifecycle,
  } = options;

  await lifecycle?.onBuildingPrompt?.();
  const system = buildTopicsSystemPrompt(request.category);
  const prompt = buildTopicsUserPrompt(request);

  await lifecycle?.onRequestingProvider?.();
  const result = await generateStructuredObject({
    model,
    system,
    prompt,
    schema: generateTopicsOutputSchema,
    operation,
    metadata,
    providerRouting,
    timeoutMs,
    maxRetries,
  });

  await lifecycle?.onNormalizingOutput?.();
  const persistedTags = await loadPersistedTags();
  await lifecycle?.onCanonicalizingTags?.();
  await lifecycle?.onValidatingOutput?.();

  let response: GenerateTopicsResponse;
  try {
    response = normalizeTopicsResponse(
      result.object as GenerateTopicsResponse,
      request.limit ?? 4,
      persistedTags
    );
  } catch (error) {
    rethrowWithProviderGenerationId(error, result.providerGenerationId);
  }

  return {
    response,
    result: result as GenerateStructuredObjectResult<GenerateTopicsResponse>,
  };
}

export async function executeDraftGeneration(
  options: BaseExecutionOptions<GenerateDraftRequest>
): Promise<ExecutionResult<GenerateDraftResponse>> {
  const {
    model,
    request,
    operation,
    metadata,
    providerRouting,
    timeoutMs,
    maxRetries,
    generateStructuredObject,
    loadPersistedTags,
    lifecycle,
  } = options;

  await lifecycle?.onBuildingPrompt?.();
  const system = buildDraftSystemPrompt(request.category);
  const prompt = buildDraftUserPrompt(request);

  await lifecycle?.onRequestingProvider?.();
  const result = await generateStructuredObject({
    model,
    system,
    prompt,
    schema: generateDraftOutputSchema,
    operation,
    metadata,
    providerRouting,
    timeoutMs,
    maxRetries,
  });

  await lifecycle?.onNormalizingOutput?.();
  const persistedTags = await loadPersistedTags();
  await lifecycle?.onCanonicalizingTags?.();
  await lifecycle?.onValidatingOutput?.();

  let response: GenerateDraftResponse;
  try {
    response = normalizeDraftResponse(result.object as GenerateDraftResponse, persistedTags);
  } catch (error) {
    rethrowWithProviderGenerationId(error, result.providerGenerationId);
  }

  return {
    response,
    result: result as GenerateStructuredObjectResult<GenerateDraftResponse>,
  };
}
