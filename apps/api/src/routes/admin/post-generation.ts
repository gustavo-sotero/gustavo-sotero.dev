/**
 * Admin routes for AI-assisted post generation.
 *
 * Protected by `authAdmin` + CSRF middleware applied globally in app.ts.
 * Feature-gated: returns 503 when AI_POSTS_ENABLED=false.
 *
 * Routes:
 *  POST /admin/posts/generate/topics  - Generate topic suggestions
 *  POST /admin/posts/generate/draft   - Generate a complete post draft
 */

import {
  generateDraftRequestSchema,
  generateTopicsRequestSchema,
} from '@portfolio/shared/schemas/ai-post-generation';
import { Hono } from 'hono';
import { AiGenerationError } from '../../lib/ai/generateStructuredObject';
import { errorResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody } from '../../lib/validate';
import { createRateLimit } from '../../middleware/rateLimit';
import {
  generatePostDraft,
  generateTopicSuggestions,
} from '../../services/post-generation.service';
import type { AppEnv } from '../../types/index';

export const adminPostGenerationRouter = new Hono<AppEnv>();

const topicsRateLimit = createRateLimit({
  maxRequests: 10,
  windowMs: 60_000,
  keyPrefix: 'rl:ai-topics',
});

const draftRateLimit = createRateLimit({
  maxRequests: 5,
  windowMs: 60_000,
  keyPrefix: 'rl:ai-draft',
});

/**
 * POST /admin/posts/generate/topics
 * Return 3–5 editorial topic suggestions for the given category and briefing.
 */
adminPostGenerationRouter.post('/topics', topicsRateLimit, async (c) => {
  const bv = await parseAndValidateBody(c, generateTopicsRequestSchema);
  if (!bv.ok) return bv.response;

  try {
    const result = await generateTopicSuggestions(bv.data);
    return successResponse(c, result);
  } catch (err) {
    return handleGenerationError(c, err);
  }
});

/**
 * POST /admin/posts/generate/draft
 * Generate a complete post draft from the approved topic suggestion.
 */
adminPostGenerationRouter.post('/draft', draftRateLimit, async (c) => {
  const bv = await parseAndValidateBody(c, generateDraftRequestSchema);
  if (!bv.ok) return bv.response;

  try {
    const result = await generatePostDraft(bv.data);
    return successResponse(c, result);
  } catch (err) {
    return handleGenerationError(c, err);
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────

function handleGenerationError(c: Parameters<typeof errorResponse>[0], err: unknown): Response {
  if (err instanceof AiGenerationError) {
    if (err.kind === 'timeout') {
      return errorResponse(
        c,
        503,
        'SERVICE_UNAVAILABLE',
        'AI provider timed out. Try again in a few seconds.'
      );
    }
    if (err.kind === 'refusal') {
      return errorResponse(
        c,
        503,
        'SERVICE_UNAVAILABLE',
        'AI provider refused the request. Adjust your briefing and try again.'
      );
    }
    if (err.kind === 'validation') {
      return errorResponse(
        c,
        503,
        'SERVICE_UNAVAILABLE',
        'AI generated an incomplete response. Please try again.'
      );
    }
    return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'AI provider is unavailable.');
  }

  const anyErr = err as Error & { code?: string };
  if (anyErr?.code === 'DISABLED') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'AI post generation is not enabled on this instance.'
    );
  }

  throw err;
}
