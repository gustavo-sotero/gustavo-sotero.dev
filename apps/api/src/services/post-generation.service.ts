import type {
  GenerateDraftRequest,
  GenerateTopicsRequest,
  PersistedTagForNormalization,
} from '@portfolio/shared';
import {
  AI_POST_MAX_DRAFT_TAG_NAMES,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildFallbackImagePrompt,
  buildTopicsSystemPrompt,
  buildTopicsUserPrompt,
  canonicalizeSuggestedTagNames,
  containsDisallowedInlineHtml,
  generateDraftOutputSchema,
  generateDraftResponseSchema,
  generateTopicsOutputSchema,
  normalizeContent,
  normalizeLinkedInPost,
  normalizeTopicSuggestion,
  normalizeTopicsRequest,
  normalizeTopicsResponse,
} from '@portfolio/shared';
import { generateSlug } from '@portfolio/shared/lib/slug';
import type {
  GenerateDraftResponse,
  GenerateTopicsResponse,
} from '@portfolio/shared/types/ai-post-generation';
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

// ── Output normalization ──────────────────────────────────────────────────────

function normalizeDraftResponse(
  raw: GenerateDraftResponse,
  persistedTags: PersistedTagForNormalization[] = []
): GenerateDraftResponse {
  const title = raw.title.trim();
  const slug = generateSlug(raw.slug.trim() || title);
  const excerpt = raw.excerpt.trim();
  const content = normalizeContent(raw.content);

  if (containsDisallowedInlineHtml(content)) {
    throw new AiGenerationError(
      'validation',
      'Generated draft contained inline HTML instead of clean Markdown'
    );
  }

  const imagePrompt = raw.imagePrompt.trim() || buildFallbackImagePrompt(title);
  const suggestedTagNames = canonicalizeSuggestedTagNames(
    raw.suggestedTagNames,
    persistedTags
  ).slice(0, AI_POST_MAX_DRAFT_TAG_NAMES);
  const notes = raw.notes?.trim() ?? null;
  const linkedinPost = normalizeLinkedInPost(
    raw.linkedinPost?.trim() ?? '',
    slug,
    suggestedTagNames
  );

  const parsed = generateDraftResponseSchema.safeParse({
    title,
    slug,
    excerpt,
    content,
    suggestedTagNames,
    imagePrompt,
    linkedinPost,
    notes,
  });
  if (!parsed.success) {
    throw new AiGenerationError(
      'validation',
      'Generated draft is too short or missing required fields'
    );
  }

  return parsed.data;
}

function normalizeDraftRequest(
  req: GenerateDraftRequest,
  persistedTags: PersistedTagForNormalization[] = []
): GenerateDraftRequest {
  return {
    ...req,
    briefing: req.briefing?.trim() || null,
    selectedSuggestion: normalizeTopicSuggestion(req.selectedSuggestion, persistedTags),
    rejectedAngles: req.rejectedAngles.map((angle) => angle.trim()).filter(Boolean),
  };
}

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
 * Throws a generic Error if the feature is disabled.
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
