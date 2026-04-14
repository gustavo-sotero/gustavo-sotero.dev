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
        'O provedor de IA demorou demais para responder. Tente novamente em alguns segundos.'
      );
    }
    if (err.kind === 'refusal') {
      return errorResponse(
        c,
        503,
        'SERVICE_UNAVAILABLE',
        'A IA recusou a solicitação. Ajuste o briefing e tente novamente.'
      );
    }
    if (err.kind === 'validation') {
      return errorResponse(
        c,
        503,
        'SERVICE_UNAVAILABLE',
        'A IA gerou uma resposta incompleta. Tente novamente.'
      );
    }
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'O provedor de IA está indisponível no momento.'
    );
  }

  const anyErr = err as Error & { code?: string };
  if (anyErr?.code === 'DISABLED') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'A geração de posts com IA não está habilitada nesta instância.'
    );
  }

  throw err;
}
