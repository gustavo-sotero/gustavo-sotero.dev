/**
 * Admin routes for AI-assisted post generation.
 *
 * Protected by `authAdmin` + CSRF middleware applied globally in app.ts.
 * Feature-gated: returns 503 when AI_POSTS_ENABLED=false.
 *
 * Routes:
 *  GET  /admin/posts/generate/config  - Get current config state
 *  PUT  /admin/posts/generate/config  - Save active model pair (validated)
 *  GET  /admin/posts/generate/models  - List eligible OpenRouter models (paginated)
 *  POST /admin/posts/generate/topics  - Generate topic suggestions
 *  POST /admin/posts/generate/draft   - Generate a complete post draft
 */

import {
  aiPostGenerationModelsQuerySchema,
  generateDraftRequestSchema,
  generateTopicsRequestSchema,
  updateAiPostGenerationConfigSchema,
} from '@portfolio/shared';
import { Hono } from 'hono';
import { AiGenerationError } from '../../lib/ai/generateStructuredObject';
import { errorResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateQuery } from '../../lib/validate';
import { createRateLimit } from '../../middleware/rateLimit';
import {
  getAiPostGenerationConfigState,
  saveAiPostGenerationConfig,
} from '../../services/ai-post-generation-settings.service';
import { listEligibleModelsPaginated } from '../../services/openrouter-models.service';
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
 * GET /admin/posts/generate/config
 * Return the current feature state and active model configuration.
 */
adminPostGenerationRouter.get('/config', async (c) => {
  const state = await getAiPostGenerationConfigState();
  return successResponse(c, state);
});

/**
 * PUT /admin/posts/generate/config
 * Validate and persist the active model pair.
 */
adminPostGenerationRouter.put('/config', async (c) => {
  const bv = await parseAndValidateBody(c, updateAiPostGenerationConfigSchema);
  if (!bv.ok) return bv.response;

  const adminGithubId = c.get('adminId') ?? 'unknown';

  try {
    const state = await saveAiPostGenerationConfig(bv.data, adminGithubId);
    return successResponse(c, state);
  } catch (err) {
    return handleConfigSaveError(c, err);
  }
});

/**
 * GET /admin/posts/generate/models
 * Return a paginated, searchable list of eligible OpenRouter models.
 */
adminPostGenerationRouter.get('/models', async (c) => {
  const qv = validateQuery(c, aiPostGenerationModelsQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    q: c.req.query('q'),
    forceRefresh: c.req.query('forceRefresh'),
  });
  if (!qv.ok) return qv.response;

  try {
    const result = await listEligibleModelsPaginated(qv.data);
    return c.json({
      success: true,
      data: result.models,
      meta: result.meta,
    });
  } catch (_err) {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'Catálogo de modelos temporariamente indisponível.'
    );
  }
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

// ── Error handlers ────────────────────────────────────────────────────────────

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

  if (anyErr?.code === 'NOT_CONFIGURED') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'A geração de posts com IA não está configurada. Configure os modelos na página de configurações.'
    );
  }

  if (anyErr?.code === 'INVALID_CONFIG') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'A configuração de modelos de IA é inválida. Atualize os modelos na página de configurações.'
    );
  }

  throw err;
}

function handleConfigSaveError(c: Parameters<typeof errorResponse>[0], err: unknown): Response {
  const anyErr = err as Error & { code?: string; issues?: string[] };

  if (anyErr?.code === 'DISABLED') {
    return errorResponse(c, 403, 'FORBIDDEN', 'A geração de posts com IA está desabilitada.');
  }

  if (anyErr?.code === 'NO_API_KEY') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'OPENROUTER_API_KEY não está configurada no servidor.'
    );
  }

  if (anyErr?.code === 'CATALOG_UNAVAILABLE') {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'Catálogo de modelos temporariamente indisponível. Tente novamente em instantes.'
    );
  }

  if (anyErr?.code === 'INVALID_MODELS') {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      anyErr.message,
      anyErr.issues?.map((msg) => ({ message: msg }))
    );
  }

  throw err;
}
