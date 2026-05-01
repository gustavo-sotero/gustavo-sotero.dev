import {
  normalizeDraftRequest,
  normalizeDraftResponse,
} from '@portfolio/shared/lib/ai-draft-normalizer';
import {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildTopicsSystemPrompt,
  buildTopicsUserPrompt,
} from '@portfolio/shared/lib/ai-post-prompts';
import {
  normalizeTopicsRequest,
  normalizeTopicsResponse,
} from '@portfolio/shared/lib/ai-topic-normalizer';
import type {
  GenerateDraftRequest,
  GenerateDraftResponse,
  GenerateTopicsRequest,
  GenerateTopicsResponse,
} from '@portfolio/shared/schemas/ai-post-generation';
import {
  generateDraftOutputSchema,
  generateTopicsOutputSchema,
} from '@portfolio/shared/schemas/ai-post-generation';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { AiGenerationError, generateStructuredObject } from '../lib/ai/generateStructuredObject';
import { findAllTagsForNormalization } from '../repositories/tags.repo';
import {
  resolveActiveAiDraftGenerationConfig,
  resolveActiveAiTopicGenerationConfig,
} from './ai-post-generation-settings.service';

const logger = getLogger('services', 'post-generation');
const SYNC_AI_GENERATION_MAX_RETRIES = 0;

function logValidationFailure(
  operation: 'topics' | 'draft',
  category: string,
  model: string,
  error: string
) {
  logger.warn('AI post generation validation failed after normalization', {
    operation,
    category,
    model,
    success: false,
    timeout: false,
    refusal: false,
    validationFailure: true,
    error,
  });
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Generate topic suggestions for the AI post generation assistant.
 *
 * Returns a structured list of editorial theme suggestions for the given
 * category. Nothing is persisted — the result is ephemeral.
 *
 * Throws `AiGenerationError` on provider failure, timeout, or refusal.
 * Throws a generic Error if the feature is disabled.
 */
export async function generateTopicSuggestions(
  req: GenerateTopicsRequest
): Promise<GenerateTopicsResponse> {
  const [activeConfig, persistedTags] = await Promise.all([
    resolveActiveAiTopicGenerationConfig(),
    findAllTagsForNormalization(),
  ]);
  const normalizedReq = normalizeTopicsRequest(req, {
    maxBriefingChars: env.AI_POSTS_MAX_BRIEFING_CHARS,
    maxSuggestions: env.AI_POSTS_MAX_SUGGESTIONS,
  });
  const model = activeConfig.topicsModelId;

  try {
    const result = await generateStructuredObject({
      model,
      system: buildTopicsSystemPrompt(normalizedReq.category),
      prompt: buildTopicsUserPrompt(normalizedReq),
      schema: generateTopicsOutputSchema,
      operation: 'topics',
      metadata: { category: normalizedReq.category },
      providerRouting: activeConfig.topicsRouting ?? undefined,
      timeoutMs: env.AI_POSTS_TIMEOUT_MS,
      maxRetries: SYNC_AI_GENERATION_MAX_RETRIES,
    });

    return normalizeTopicsResponse(
      result.object as GenerateTopicsResponse,
      normalizedReq.limit,
      persistedTags
    );
  } catch (err) {
    if (err instanceof AiGenerationError && err.kind === 'validation') {
      logValidationFailure('topics', normalizedReq.category, model, err.message);
    }
    throw err;
  }
}

/**
 * Generate a complete post draft from an approved topic suggestion.
 *
 * Returns structured editorial content for all form fields. Nothing is
 * persisted — the result requires explicit user approval in the admin UI.
 *
 * Throws `AiGenerationError` on provider failure, timeout, or refusal.
 * Throws a typed configuration error if the feature is unavailable.
 */
export async function generatePostDraft(req: GenerateDraftRequest): Promise<GenerateDraftResponse> {
  const [activeConfig, persistedTags] = await Promise.all([
    resolveActiveAiDraftGenerationConfig(),
    findAllTagsForNormalization(),
  ]);
  const normalizedReq = normalizeDraftRequest(req, persistedTags);
  const model = activeConfig.draftModelId;

  try {
    const result = await generateStructuredObject({
      model,
      system: buildDraftSystemPrompt(normalizedReq.category),
      prompt: buildDraftUserPrompt(normalizedReq),
      schema: generateDraftOutputSchema,
      operation: 'draft',
      metadata: { category: normalizedReq.category },
      providerRouting: activeConfig.draftRouting ?? undefined,
      timeoutMs: env.AI_POSTS_TIMEOUT_MS,
      maxRetries: SYNC_AI_GENERATION_MAX_RETRIES,
    });

    return normalizeDraftResponse(result.object as GenerateDraftResponse, persistedTags);
  } catch (err) {
    if (err instanceof AiGenerationError && err.kind === 'validation') {
      logValidationFailure('draft', normalizedReq.category, model, err.message);
    }
    throw err;
  }
}
