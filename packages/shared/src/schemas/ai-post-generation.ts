import { z } from 'zod';
import {
  AI_POST_CONCRETE_CATEGORIES,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_DRAFT_RUN_STAGES,
  AI_POST_DRAFT_RUN_STATUSES,
  AI_POST_MAX_BRIEFING_CHARS,
  AI_POST_MAX_DRAFT_TAG_NAMES,
  AI_POST_MAX_EXCERPT_CHARS,
  AI_POST_MAX_EXCLUDED_ITEMS,
  AI_POST_MAX_EXCLUDED_TEXT_CHARS,
  AI_POST_MAX_SUGGESTIONS,
  AI_POST_MAX_TOPIC_TAG_NAMES,
  AI_POST_MIN_DRAFT_CONTENT_CHARS,
  AI_POST_MIN_SUGGESTIONS,
  AI_POST_REQUESTED_CATEGORIES,
  AI_POST_TOPIC_RUN_STAGES,
  AI_POST_TOPIC_RUN_STATUSES,
} from '../constants/ai-posts';

const requiredString = z.string().trim().min(1, 'Campo obrigatório');
const plainRequiredString = z.string().min(1);

// ── Topic suggestion request ──────────────────────────────────────────────────

export const generateTopicsRequestSchema = z.object({
  /** Accepts misto in addition to the five concrete categories. */
  category: z.enum(AI_POST_REQUESTED_CATEGORIES),
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
// category must be a concrete value — never 'misto'

export const topicSuggestionSchema = z.object({
  suggestionId: requiredString,
  /** Always a concrete category — never 'misto'. */
  category: z.enum(AI_POST_CONCRETE_CATEGORIES),
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
  /** The category originally requested (may be 'misto' when topics came from mixed generation). */
  category: z.enum(AI_POST_REQUESTED_CATEGORIES),
  briefing: z
    .string()
    .max(
      AI_POST_MAX_BRIEFING_CHARS,
      `Briefing deve ter no máximo ${AI_POST_MAX_BRIEFING_CHARS} caracteres`
    )
    .transform((v) => v.trim())
    .nullable()
    .default(null),
  /** The selected topic — carries its own concrete category. */
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
  linkedinPost: requiredString,
  notes: requiredString.nullable(),
});

export type GenerateDraftResponse = z.infer<typeof generateDraftResponseSchema>;

// ── Structured output schemas (for AI provider — no transforms) ───────────────
// These use plain objects without transforms so OpenAI structured outputs
// can map them directly. They mirror the response schemas without transforms.

export const topicSuggestionOutputSchema = z.object({
  suggestionId: plainRequiredString,
  /** The model must return a concrete category. */
  category: z.enum(AI_POST_CONCRETE_CATEGORIES),
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
  linkedinPost: plainRequiredString,
  notes: plainRequiredString.nullable(),
});

// ── Draft Run API schemas ─────────────────────────────────────────────────────

/**
 * POST /admin/posts/generate/draft-runs — input body.
 * Same business payload as the synchronous draft endpoint.
 */
export const createDraftRunRequestSchema = generateDraftRequestSchema;
export type CreateDraftRunRequest = GenerateDraftRequest;

/**
 * POST /admin/posts/generate/draft-runs — 202 response body.
 */
export const createDraftRunResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(AI_POST_DRAFT_RUN_STATUSES),
  stage: z.enum(AI_POST_DRAFT_RUN_STAGES),
  /** Recommended initial poll interval in ms. */
  pollAfterMs: z.number().int().positive(),
  createdAt: z.string(),
});

export type CreateDraftRunResponse = z.infer<typeof createDraftRunResponseSchema>;

/**
 * GET /admin/posts/generate/draft-runs/:id — response body.
 */
export const draftRunStatusResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(AI_POST_DRAFT_RUN_STATUSES),
  stage: z.enum(AI_POST_DRAFT_RUN_STAGES),
  requestedCategory: z.enum(AI_POST_REQUESTED_CATEGORIES),
  selectedSuggestionCategory: z.enum(AI_POST_CONCRETE_CATEGORIES).nullable(),
  /** @deprecated Use `selectedSuggestionCategory`. Kept for compatibility. */
  concreteCategory: z.enum(AI_POST_CONCRETE_CATEGORIES).nullable(),
  modelId: z.string().nullable(),
  attemptCount: z.number().int(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  error: z
    .object({
      kind: z.string(),
      code: z.string().nullable(),
      message: z.string(),
    })
    .nullable(),
  /** Present only when status === 'completed'. */
  result: generateDraftResponseSchema.nullable(),
});

export type DraftRunStatusResponse = z.infer<typeof draftRunStatusResponseSchema>;

// ── Topic Run API schemas ─────────────────────────────────────────────────────

/**
 * POST /admin/posts/generate/topic-runs — input body.
 * Same business payload as the synchronous topics endpoint.
 */
export const createTopicRunRequestSchema = generateTopicsRequestSchema;
export type CreateTopicRunRequest = GenerateTopicsRequest;

/**
 * POST /admin/posts/generate/topic-runs — 202 response body.
 */
export const createTopicRunResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(AI_POST_TOPIC_RUN_STATUSES),
  stage: z.enum(AI_POST_TOPIC_RUN_STAGES),
  /** Recommended initial poll interval in ms. */
  pollAfterMs: z.number().int().positive(),
  createdAt: z.string(),
});

export type CreateTopicRunResponse = z.infer<typeof createTopicRunResponseSchema>;

/**
 * GET /admin/posts/generate/topic-runs/:id — response body.
 */
export const topicRunStatusResponseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(AI_POST_TOPIC_RUN_STATUSES),
  stage: z.enum(AI_POST_TOPIC_RUN_STAGES),
  requestedCategory: z.enum(AI_POST_REQUESTED_CATEGORIES),
  modelId: z.string().nullable(),
  attemptCount: z.number().int(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  error: z
    .object({
      kind: z.string(),
      code: z.string().nullable(),
      message: z.string(),
    })
    .nullable(),
  /** Present only when status === 'completed'. */
  result: generateTopicsResponseSchema.nullable(),
});

export type TopicRunStatusResponse = z.infer<typeof topicRunStatusResponseSchema>;
