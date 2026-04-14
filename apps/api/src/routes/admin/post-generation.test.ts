import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { generateTopicSuggestionsMock, generatePostDraftMock } = vi.hoisted(() => ({
  generateTopicSuggestionsMock: vi.fn(),
  generatePostDraftMock: vi.fn(),
}));

vi.mock('../../services/post-generation.service', () => ({
  generateTopicSuggestions: generateTopicSuggestionsMock,
  generatePostDraft: generatePostDraftMock,
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
    if (c.req.method === 'POST' || c.req.method === 'PATCH' || c.req.method === 'DELETE') {
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
    });
  });
});
