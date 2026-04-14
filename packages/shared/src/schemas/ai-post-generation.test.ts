import { describe, expect, it } from 'vitest';
import {
  generateDraftRequestSchema,
  generateDraftResponseSchema,
  generateTopicsRequestSchema,
  generateTopicsResponseSchema,
} from './ai-post-generation';

describe('ai-post-generation schemas', () => {
  // ── generateTopicsRequestSchema ───────────────────────────────────────────

  describe('generateTopicsRequestSchema', () => {
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
        notes: null,
      });

      expect(result.success).toBe(false);
    });
  });
});
