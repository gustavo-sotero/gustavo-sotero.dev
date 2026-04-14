import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  generateTopicSuggestionsMock,
  generatePostDraftMock,
  getAiPostGenerationConfigStateMock,
  saveAiPostGenerationConfigMock,
  listEligibleModelsPaginatedMock,
} = vi.hoisted(() => ({
  generateTopicSuggestionsMock: vi.fn(),
  generatePostDraftMock: vi.fn(),
  getAiPostGenerationConfigStateMock: vi.fn(),
  saveAiPostGenerationConfigMock: vi.fn(),
  listEligibleModelsPaginatedMock: vi.fn(),
}));

vi.mock('../../services/post-generation.service', () => ({
  generateTopicSuggestions: generateTopicSuggestionsMock,
  generatePostDraft: generatePostDraftMock,
}));

vi.mock('../../services/ai-post-generation-settings.service', () => ({
  getAiPostGenerationConfigState: getAiPostGenerationConfigStateMock,
  saveAiPostGenerationConfig: saveAiPostGenerationConfigMock,
}));

vi.mock('../../services/openrouter-models.service', () => ({
  listEligibleModelsPaginated: listEligibleModelsPaginatedMock,
}));

vi.mock('../../middleware/auth', () => ({
  authAdmin: async (
    c: { req: { header: (name: string) => string | undefined }; res?: Response },
    next: () => Promise<void>
  ) => {
    const cookie = c.req.header('cookie') ?? '';
    if (!cookie.includes('admin_token=valid-session')) {
      c.res = new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return;
    }

    await next();
  },
}));

vi.mock('../../middleware/csrf', () => ({
  csrfProtection: async (
    c: { req: { header: (name: string) => string | undefined }; res?: Response },
    next: () => Promise<void>
  ) => {
    const cookie = c.req.header('cookie') ?? '';
    const csrfHeader = c.req.header('x-csrf-token') ?? '';

    if (!cookie.includes(`csrf_token=${csrfHeader}`) || !csrfHeader) {
      c.res = new Response(
        JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid CSRF token' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return;
    }

    await next();
  },
}));

// Always allow rate limit in tests
vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getClientIp: () => '127.0.0.1',
}));

import { AiGenerationError } from '../../lib/ai/generateStructuredObject';
import { authAdmin } from '../../middleware/auth';
import { csrfProtection } from '../../middleware/csrf';
import type { AppEnv } from '../../types/index';
import { adminPostGenerationRouter } from './post-generation';

const VALID_CONFIG_STATE = {
  status: 'ready' as const,
  topicsModelId: 'openai/gpt-4o',
  draftModelId: 'openai/gpt-4o',
  updatedBy: 'admin',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const VALID_TOPICS_BODY = {
  category: 'backend-arquitetura',
  briefing: null,
  limit: 4,
  excludedIdeas: [],
};

const VALID_DRAFT_BODY = {
  category: 'backend-arquitetura',
  briefing: null,
  selectedSuggestion: {
    suggestionId: 'abc1',
    category: 'backend-arquitetura',
    proposedTitle: 'Tema',
    angle: 'Ângulo',
    summary: 'Resumo',
    targetReader: 'Desenvolvedor',
    suggestedTagNames: ['TypeScript'],
    rationale: 'Motivo',
  },
  rejectedAngles: [],
};

function buildApp() {
  const app = new Hono();
  app.route('/admin/posts/generate', adminPostGenerationRouter);
  return app;
}

function buildProtectedApp() {
  const app = new Hono<AppEnv>();
  app.use('/admin/*', authAdmin);
  app.use('/admin/*', async (c, next) => {
    if (
      c.req.method === 'POST' ||
      c.req.method === 'PUT' ||
      c.req.method === 'PATCH' ||
      c.req.method === 'DELETE'
    ) {
      return csrfProtection(c, next);
    }
    await next();
  });
  app.route('/admin/posts/generate', adminPostGenerationRouter);
  return app;
}

describe('admin post-generation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiPostGenerationConfigStateMock.mockResolvedValue(VALID_CONFIG_STATE);
  });

  it('returns 401 when admin session is missing', async () => {
    const app = buildProtectedApp();
    const res = await app.request('/admin/posts/generate/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'csrf-token',
        cookie: 'csrf_token=csrf-token',
      },
      body: JSON.stringify(VALID_TOPICS_BODY),
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF token is missing or invalid', async () => {
    const app = buildProtectedApp();
    const res = await app.request('/admin/posts/generate/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'admin_token=valid-session; csrf_token=csrf-token',
      },
      body: JSON.stringify(VALID_TOPICS_BODY),
    });

    expect(res.status).toBe(403);
  });

  // ── GET /admin/posts/generate/config ─────────────────────────────────────

  describe('GET /config', () => {
    it('returns 200 with config state on success', async () => {
      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', { method: 'GET' });

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ready');
      expect(body.data.topicsModelId).toBe('openai/gpt-4o');
    });
  });

  // ── PUT /admin/posts/generate/config ─────────────────────────────────────

  describe('PUT /config', () => {
    it('returns 200 with updated config state on success', async () => {
      saveAiPostGenerationConfigMock.mockResolvedValueOnce(VALID_CONFIG_STATE);

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
      });

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ready');
    });

    it('returns 400 for missing body fields', async () => {
      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when feature is disabled', async () => {
      saveAiPostGenerationConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('disabled'), { code: 'DISABLED' })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
      });

      expect(res.status).toBe(403);
    });

    it('returns 400 when models are invalid', async () => {
      saveAiPostGenerationConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('Invalid models'), {
          code: 'INVALID_MODELS',
          issues: ['Model openai/gpt-bad is not available'],
        })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicsModelId: 'openai/gpt-bad', draftModelId: 'openai/gpt-bad' }),
      });

      expect(res.status).toBe(400);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when catalog is unavailable', async () => {
      saveAiPostGenerationConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('catalog unavailable'), { code: 'CATALOG_UNAVAILABLE' })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
      });

      expect(res.status).toBe(503);
    });

    it('returns 403 when CSRF token is invalid (via protected app)', async () => {
      const app = buildProtectedApp();
      const res = await app.request('/admin/posts/generate/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'admin_token=valid-session; csrf_token=csrf-token',
          // no x-csrf-token header
        },
        body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /admin/posts/generate/models ─────────────────────────────────────

  describe('GET /models', () => {
    it('returns 200 with paginated models on success', async () => {
      listEligibleModelsPaginatedMock.mockResolvedValueOnce({
        models: [
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            contextLength: 128000,
            supportsStructuredOutputs: true,
          },
        ],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/models', { method: 'GET' });

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta.total).toBe(1);
    });

    it('returns 503 when catalog fetch fails', async () => {
      listEligibleModelsPaginatedMock.mockRejectedValueOnce(new Error('network error'));

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/models', { method: 'GET' });

      expect(res.status).toBe(503);
    });

    it('passes forceRefresh query param to service', async () => {
      listEligibleModelsPaginatedMock.mockResolvedValueOnce({
        models: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      const app = buildApp();
      await app.request('/admin/posts/generate/models?forceRefresh=true', { method: 'GET' });

      expect(listEligibleModelsPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true })
      );
    });
  });

  // ── POST /admin/posts/generate/topics ─────────────────────────────────────

  describe('POST /topics', () => {
    it('returns 200 with suggestions on success', async () => {
      const expected = {
        suggestions: [
          {
            suggestionId: 's1',
            category: 'backend-arquitetura',
            proposedTitle: 'Tema 1',
            angle: 'A',
            summary: 'S',
            targetReader: 'Dev',
            suggestedTagNames: [],
            rationale: 'R',
          },
        ],
      };
      generateTopicSuggestionsMock.mockResolvedValueOnce(expected);

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(expected);
    });

    it('returns 400 for invalid category', async () => {
      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'invalid-category', briefing: null }),
      });

      expect(res.status).toBe(400);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when feature is disabled', async () => {
      generateTopicSuggestionsMock.mockRejectedValueOnce(
        Object.assign(new Error('disabled'), { code: 'DISABLED' })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(503);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(body.error.message).toBe(
        'A geração de posts com IA não está habilitada nesta instância.'
      );
    });

    it('returns 503 on provider timeout', async () => {
      generateTopicSuggestionsMock.mockRejectedValueOnce(
        new AiGenerationError('timeout', 'timed out')
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(503);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.message).toBe(
        'O provedor de IA demorou demais para responder. Tente novamente em alguns segundos.'
      );
    });

    it('returns 503 on provider refusal', async () => {
      generateTopicSuggestionsMock.mockRejectedValueOnce(
        new AiGenerationError('refusal', 'refused')
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(503);
    });

    it('returns 503 when config is not configured', async () => {
      generateTopicSuggestionsMock.mockRejectedValueOnce(
        Object.assign(new Error('not configured'), { code: 'NOT_CONFIGURED' })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(503);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 503 when config is invalid', async () => {
      generateTopicSuggestionsMock.mockRejectedValueOnce(
        Object.assign(new Error('invalid config'), { code: 'INVALID_CONFIG' })
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_TOPICS_BODY),
      });

      expect(res.status).toBe(503);
    });
  });

  // ── POST /admin/posts/generate/draft ─────────────────────────────────────

  describe('POST /draft', () => {
    it('returns 200 with draft on success', async () => {
      const expected = {
        title: 'Post Gerado',
        slug: 'post-gerado',
        excerpt: 'Resumo curto.',
        content: '## Intro\n\nConteúdo.',
        suggestedTagNames: ['TypeScript'],
        imagePrompt: 'dark illustration',
        notes: null,
      };
      generatePostDraftMock.mockResolvedValueOnce(expected);

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_DRAFT_BODY),
      });

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Post Gerado');
    });

    it('returns 400 for missing selectedSuggestion', async () => {
      const app = buildApp();
      const res = await app.request('/admin/posts/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'backend-arquitetura' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 503 on validation failure from service', async () => {
      generatePostDraftMock.mockRejectedValueOnce(
        new AiGenerationError('validation', 'draft too short')
      );

      const app = buildApp();
      const res = await app.request('/admin/posts/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_DRAFT_BODY),
      });

      expect(res.status).toBe(503);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const body = (await res.json()) as any;
      expect(body.error.message).toBe('A IA gerou uma resposta incompleta. Tente novamente.');
    });
  });
});
