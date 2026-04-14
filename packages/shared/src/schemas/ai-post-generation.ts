import { z } from 'zod';
import {
  AI_POST_CATEGORIES,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_BRIEFING_CHARS,
  AI_POST_MAX_DRAFT_TAG_NAMES,
  AI_POST_MAX_EXCERPT_CHARS,
  AI_POST_MAX_EXCLUDED_ITEMS,
  AI_POST_MAX_EXCLUDED_TEXT_CHARS,
  AI_POST_MAX_SUGGESTIONS,
  AI_POST_MAX_TOPIC_TAG_NAMES,
  AI_POST_MIN_DRAFT_CONTENT_CHARS,
  AI_POST_MIN_SUGGESTIONS,
} from '../constants/ai-posts';

const requiredString = z.string().trim().min(1, 'Campo obrigatório');
const plainRequiredString = z.string().min(1);

// ── Topic suggestion request ──────────────────────────────────────────────────

export const generateTopicsRequestSchema = z.object({
  category: z.enum(AI_POST_CATEGORIES),
  briefing: z
    .string()
    .max(
      AI_POST_MAX_BRIEFING_CHARS,
      `Briefing deve ter no máximo ${AI_POST_MAX_BRIEFING_CHARS} caracteres`
    )
    .transform((v) => v.trim())
    .nullable()
    .default(null),
  limit: z
    .number()
    .int()
    .min(AI_POST_MIN_SUGGESTIONS)
    .max(AI_POST_MAX_SUGGESTIONS)
    .default(AI_POST_DEFAULT_SUGGESTIONS),
  excludedIdeas: z
    .array(requiredString.max(AI_POST_MAX_EXCLUDED_TEXT_CHARS))
    .max(AI_POST_MAX_EXCLUDED_ITEMS)
    .default([]),
});

export type GenerateTopicsRequest = z.infer<typeof generateTopicsRequestSchema>;

// ── Topic suggestion (single item) ───────────────────────────────────────────

export const topicSuggestionSchema = z.object({
  suggestionId: requiredString,
  category: z.enum(AI_POST_CATEGORIES),
  proposedTitle: requiredString,
  angle: requiredString,
  summary: requiredString,
  targetReader: requiredString,
  suggestedTagNames: z.array(requiredString).max(AI_POST_MAX_TOPIC_TAG_NAMES),
  rationale: requiredString,
});

export type TopicSuggestion = z.infer<typeof topicSuggestionSchema>;

// ── Topic suggestions response ────────────────────────────────────────────────

export const generateTopicsResponseSchema = z.object({
  suggestions: z
    .array(topicSuggestionSchema)
    .min(AI_POST_MIN_SUGGESTIONS)
    .max(AI_POST_MAX_SUGGESTIONS),
});

export type GenerateTopicsResponse = z.infer<typeof generateTopicsResponseSchema>;

// ── Draft generation request ──────────────────────────────────────────────────

export const generateDraftRequestSchema = z.object({
  category: z.enum(AI_POST_CATEGORIES),
  briefing: z
    .string()
    .max(
      AI_POST_MAX_BRIEFING_CHARS,
      `Briefing deve ter no máximo ${AI_POST_MAX_BRIEFING_CHARS} caracteres`
    )
    .transform((v) => v.trim())
    .nullable()
    .default(null),
  selectedSuggestion: topicSuggestionSchema,
  rejectedAngles: z
    .array(requiredString.max(AI_POST_MAX_EXCLUDED_TEXT_CHARS))
    .max(AI_POST_MAX_EXCLUDED_ITEMS)
    .default([]),
});

export type GenerateDraftRequest = z.infer<typeof generateDraftRequestSchema>;

// ── Draft generation response ─────────────────────────────────────────────────

export const generateDraftResponseSchema = z.object({
  title: requiredString,
  slug: requiredString,
  excerpt: requiredString.max(AI_POST_MAX_EXCERPT_CHARS),
  content: requiredString.min(AI_POST_MIN_DRAFT_CONTENT_CHARS),
  suggestedTagNames: z.array(requiredString).max(AI_POST_MAX_DRAFT_TAG_NAMES),
  imagePrompt: requiredString,
  notes: requiredString.nullable(),
});

export type GenerateDraftResponse = z.infer<typeof generateDraftResponseSchema>;

// ── Structured output schemas (for AI provider — no transforms) ───────────────
// These use plain objects without transforms so OpenAI structured outputs
// can map them directly. They mirror the response schemas without transforms.

export const topicSuggestionOutputSchema = z.object({
  suggestionId: plainRequiredString,
  category: z.enum(AI_POST_CATEGORIES),
  proposedTitle: plainRequiredString,
  angle: plainRequiredString,
  summary: plainRequiredString,
  targetReader: plainRequiredString,
  suggestedTagNames: z.array(plainRequiredString).max(AI_POST_MAX_TOPIC_TAG_NAMES),
  rationale: plainRequiredString,
});

export const generateTopicsOutputSchema = z.object({
  suggestions: z
    .array(topicSuggestionOutputSchema)
    .min(AI_POST_MIN_SUGGESTIONS)
    .max(AI_POST_MAX_SUGGESTIONS),
});

export const generateDraftOutputSchema = z.object({
  title: plainRequiredString,
  slug: plainRequiredString,
  excerpt: plainRequiredString.max(AI_POST_MAX_EXCERPT_CHARS),
  content: plainRequiredString.min(AI_POST_MIN_DRAFT_CONTENT_CHARS),
  suggestedTagNames: z.array(plainRequiredString).max(AI_POST_MAX_DRAFT_TAG_NAMES),
  imagePrompt: plainRequiredString,
  notes: plainRequiredString.nullable(),
});
