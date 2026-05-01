/**
 * Style exemplars and prompt constants - re-exported from the shared prompt module.
 *
 * Kept as a re-export for backward compatibility with existing API imports.
 * New consumers should import directly from '@portfolio/shared/lib/ai-post-prompts'.
 */
export {
  BASE_IDENTITY_BLOCK,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildTopicsSystemPrompt,
  CATEGORY_INSTRUCTIONS,
  IMAGE_PROMPT_RULES,
  STYLE_EXEMPLARS,
} from '@portfolio/shared/lib/ai-post-prompts';
