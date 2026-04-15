import { describe, expect, it } from 'vitest';
import {
  createDraftRunRequestSchema,
  createDraftRunResponseSchema,
  draftRunStatusResponseSchema,
  generateDraftRequestSchema,
  generateDraftResponseSchema,
  generateTopicsRequestSchema,
  generateTopicsResponseSchema,
  topicSuggestionSchema,
} from './ai-post-generation';

describe('ai-post-generation schemas', () => {
  // ── generateTopicsRequestSchema ───────────────────────────────────────────

  describe('generateTopicsRequestSchema', () => {
    it('accepts valid request with misto category', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'misto',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid request', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown category', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'invalid-category',
      });
      expect(result.success).toBe(false);
    });

    it('rejects briefing exceeding 1000 chars', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'backend-arquitetura',
        briefing: 'x'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects limit below 3', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'backend-arquitetura',
        limit: 2,
      });
      expect(result.success).toBe(false);
    });

    it('rejects limit above 5', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'backend-arquitetura',
        limit: 6,
      });
      expect(result.success).toBe(false);
    });

    it('defaults limit and excludedIdeas when omitted', () => {
      const result = generateTopicsRequestSchema.safeParse({
        category: 'carreira-senioridade-pensamento',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.excludedIdeas).toEqual([]);
      }
    });
  });

  // ── generateDraftRequestSchema ────────────────────────────────────────────

  describe('generateDraftRequestSchema', () => {
    const validSuggestion = {
      suggestionId: 'abc1',
      category: 'backend-arquitetura',
      proposedTitle: 'Tema',
      angle: 'Ângulo',
      summary: 'Resumo',
      targetReader: 'Dev',
      suggestedTagNames: ['TypeScript'],
      rationale: 'Motivo',
    };

    it('accepts valid request', () => {
      const result = generateDraftRequestSchema.safeParse({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: validSuggestion,
        rejectedAngles: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing selectedSuggestion', () => {
      const result = generateDraftRequestSchema.safeParse({
        category: 'backend-arquitetura',
      });
      expect(result.success).toBe(false);
    });

    it('rejects suggestion tag names array above max (6) in topic suggestion', () => {
      const result = generateDraftRequestSchema.safeParse({
        category: 'backend-arquitetura',
        selectedSuggestion: {
          ...validSuggestion,
          suggestedTagNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects briefing exceeding 1000 chars', () => {
      const result = generateDraftRequestSchema.safeParse({
        category: 'frontend-fullstack',
        briefing: 'x'.repeat(1001),
        selectedSuggestion: validSuggestion,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('response schemas', () => {
    it('rejects topic responses with fewer than 3 suggestions', () => {
      const result = generateTopicsResponseSchema.safeParse({
        suggestions: [
          {
            suggestionId: 'abc1',
            category: 'backend-arquitetura',
            proposedTitle: 'Tema',
            angle: 'Ângulo',
            summary: 'Resumo',
            targetReader: 'Dev',
            suggestedTagNames: ['TypeScript'],
            rationale: 'Motivo',
          },
          {
            suggestionId: 'abc2',
            category: 'backend-arquitetura',
            proposedTitle: 'Outro tema',
            angle: 'Outro ângulo',
            summary: 'Outro resumo',
            targetReader: 'Dev',
            suggestedTagNames: ['TypeScript'],
            rationale: 'Outro motivo',
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('rejects draft responses with empty required fields', () => {
      const result = generateDraftResponseSchema.safeParse({
        title: ' ',
        slug: '',
        excerpt: 'Resumo válido',
        content:
          'Conteúdo longo o suficiente para não cair na validação de tamanho mínimo, mas com título e slug inválidos.',
        suggestedTagNames: ['TypeScript'],
        imagePrompt: '',
        linkedinPost: '',
        notes: null,
      });

      expect(result.success).toBe(false);
    });

    it('rejects draft responses without linkedinPost field', () => {
      const result = generateDraftResponseSchema.safeParse({
        title: 'Título válido',
        slug: 'titulo-valido',
        excerpt: 'Resumo válido',
        content:
          'Conteúdo longo o suficiente para não cair na validação de tamanho mínimo e verificar que linkedinPost é obrigatório.',
        suggestedTagNames: ['TypeScript'],
        imagePrompt: 'Ilustração minimalista',
        notes: null,
        // linkedinPost deliberately omitted
      });

      expect(result.success).toBe(false);
    });
  });

  // ── topicSuggestionSchema ─────────────────────────────────────────────────

  describe('topicSuggestionSchema', () => {
    const validSuggestion = {
      suggestionId: 's1',
      category: 'backend-arquitetura',
      proposedTitle: 'Título',
      angle: 'Ângulo',
      summary: 'Resumo',
      targetReader: 'Dev',
      suggestedTagNames: ['TypeScript'],
      rationale: 'Motivo',
    };

    it('accepts valid concrete category', () => {
      expect(topicSuggestionSchema.safeParse(validSuggestion).success).toBe(true);
    });

    it('rejects misto category — must never be returned by the AI', () => {
      const result = topicSuggestionSchema.safeParse({ ...validSuggestion, category: 'misto' });
      expect(result.success).toBe(false);
    });

    it('rejects unknown category', () => {
      const result = topicSuggestionSchema.safeParse({ ...validSuggestion, category: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  // ── createDraftRunRequestSchema ───────────────────────────────────────────

  describe('createDraftRunRequestSchema', () => {
    const validSuggestion = {
      suggestionId: 'abc1',
      category: 'backend-arquitetura',
      proposedTitle: 'Tema',
      angle: 'Ângulo',
      summary: 'Resumo',
      targetReader: 'Dev',
      suggestedTagNames: ['TypeScript'],
      rationale: 'Motivo',
    };

    it('accepts valid request for misto category', () => {
      const result = createDraftRunRequestSchema.safeParse({
        category: 'misto',
        briefing: 'brevíssimo brief',
        selectedSuggestion: validSuggestion,
        rejectedAngles: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects request with invalid category', () => {
      const result = createDraftRunRequestSchema.safeParse({
        category: 'not-a-category',
        selectedSuggestion: validSuggestion,
      });
      expect(result.success).toBe(false);
    });
  });

  // ── createDraftRunResponseSchema ──────────────────────────────────────────

  describe('createDraftRunResponseSchema', () => {
    it('validates 202 response body', () => {
      const result = createDraftRunResponseSchema.safeParse({
        runId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'queued',
        stage: 'queued',
        pollAfterMs: 3000,
        createdAt: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-uuid runId', () => {
      const result = createDraftRunResponseSchema.safeParse({
        runId: 'not-a-uuid',
        status: 'queued',
        stage: 'queued',
        pollAfterMs: 3000,
        createdAt: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });
  });

  // ── draftRunStatusResponseSchema ──────────────────────────────────────────

  describe('draftRunStatusResponseSchema', () => {
    const base = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      stage: 'queued' as const,
      requestedCategory: 'misto',
      selectedSuggestionCategory: null,
      concreteCategory: null,
      modelId: null,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: null,
      result: null,
    };

    it('validates queued state', () => {
      expect(draftRunStatusResponseSchema.safeParse(base).success).toBe(true);
    });

    it('validates completed state with result payload', () => {
      const result = draftRunStatusResponseSchema.safeParse({
        ...base,
        status: 'completed',
        stage: 'completed',
        selectedSuggestionCategory: 'backend-arquitetura',
        concreteCategory: 'backend-arquitetura',
        modelId: 'openai/gpt-4o',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 4200,
        result: {
          title: 'Post Title',
          slug: 'post-title',
          excerpt: 'Short summary of the post.',
          content:
            '## Intro\n\nSome content here that is long enough to meet the minimum character requirement for blog post content.',
          suggestedTagNames: ['TypeScript'],
          imagePrompt: 'Ilustração técnica minimalista em fundo escuro',
          linkedinPost:
            'Post sobre TypeScript e arquitetura backend.\n\nhttps://gustavo-sotero.dev/blog/post-title\n\n#TypeScript #Backend #Nodejs',
          notes: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects completed state when result payload is missing linkedinPost', () => {
      const result = draftRunStatusResponseSchema.safeParse({
        ...base,
        status: 'completed',
        stage: 'completed',
        selectedSuggestionCategory: 'backend-arquitetura',
        concreteCategory: 'backend-arquitetura',
        modelId: 'openai/gpt-4o',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 4200,
        result: {
          title: 'Post Title',
          slug: 'post-title',
          excerpt: 'Short summary of the post.',
          content:
            '## Intro\n\nSome content here that is long enough to meet the minimum character requirement for blog post content.',
          suggestedTagNames: ['TypeScript'],
          imagePrompt: 'Ilustração técnica minimalista em fundo escuro',
          notes: null,
        },
      });

      expect(result.success).toBe(false);
    });

    it('validates failed state with error payload', () => {
      const result = draftRunStatusResponseSchema.safeParse({
        ...base,
        status: 'failed',
        stage: 'requesting-provider',
        selectedSuggestionCategory: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 30000,
        error: { kind: 'timeout', code: null, message: 'Provider timed out' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-concrete selectedSuggestionCategory values', () => {
      const result = draftRunStatusResponseSchema.safeParse({
        ...base,
        selectedSuggestionCategory: 'misto',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid status value', () => {
      const result = draftRunStatusResponseSchema.safeParse({
        ...base,
        status: 'in-flight',
      });
      expect(result.success).toBe(false);
    });
  });
});
