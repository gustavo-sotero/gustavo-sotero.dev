/**
 * Shared normalization utilities used by both the API service and the worker
 * job when processing AI-generated topic suggestions.
 */

import {
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_BRIEFING_CHARS,
  AI_POST_MAX_SUGGESTIONS,
  AI_POST_MAX_TOPIC_TAG_NAMES,
} from '../constants/ai-posts';
import {
  type GenerateTopicsRequest,
  type GenerateTopicsResponse,
  generateTopicsResponseSchema,
  type TopicSuggestion,
} from '../schemas/ai-post-generation';
import { AiGenerationError } from './ai-error';
import {
  canonicalizeSuggestedTagNames,
  type PersistedTagForNormalization,
} from './aiTagNormalizer';
import { generateSlug } from './slug';

export interface NormalizeTopicsRequestOptions {
  maxBriefingChars?: number;
  maxSuggestions?: number;
}

function normalizeBriefing(briefing: string | null, maxBriefingChars: number): string | null {
  const normalized = briefing?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxBriefingChars);
}

export function normalizeTopicsRequest(
  request: GenerateTopicsRequest,
  options: NormalizeTopicsRequestOptions = {}
): GenerateTopicsRequest {
  const maxBriefingChars = options.maxBriefingChars ?? AI_POST_MAX_BRIEFING_CHARS;
  const maxSuggestions = Math.min(
    options.maxSuggestions ?? AI_POST_MAX_SUGGESTIONS,
    AI_POST_MAX_SUGGESTIONS
  );

  return {
    ...request,
    briefing: normalizeBriefing(request.briefing, maxBriefingChars),
    limit: Math.min(request.limit ?? AI_POST_DEFAULT_SUGGESTIONS, maxSuggestions),
    excludedIdeas: request.excludedIdeas.map((idea) => idea.trim()).filter(Boolean),
  };
}

export function normalizeTopicSuggestion(
  suggestion: TopicSuggestion,
  persistedTags: PersistedTagForNormalization[] = []
): TopicSuggestion {
  return {
    ...suggestion,
    suggestionId: suggestion.suggestionId.trim() || crypto.randomUUID().slice(0, 8),
    proposedTitle: suggestion.proposedTitle.trim(),
    angle: suggestion.angle.trim(),
    summary: suggestion.summary.trim(),
    targetReader: suggestion.targetReader.trim(),
    rationale: suggestion.rationale.trim(),
    suggestedTagNames: canonicalizeSuggestedTagNames(
      suggestion.suggestedTagNames,
      persistedTags
    ).slice(0, AI_POST_MAX_TOPIC_TAG_NAMES),
  };
}

export function deduplicateTopicSuggestions(suggestions: TopicSuggestion[]): TopicSuggestion[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = generateSlug(suggestion.proposedTitle);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function normalizeTopicsResponse(
  raw: GenerateTopicsResponse,
  limit: number,
  persistedTags: PersistedTagForNormalization[] = []
): GenerateTopicsResponse {
  const unique = deduplicateTopicSuggestions(
    raw.suggestions.map((suggestion) => normalizeTopicSuggestion(suggestion, persistedTags))
  );
  const parsed = generateTopicsResponseSchema.safeParse({ suggestions: unique.slice(0, limit) });

  if (!parsed.success) {
    throw new AiGenerationError(
      'validation',
      'Generated topics did not satisfy the response contract'
    );
  }

  return parsed.data;
}
