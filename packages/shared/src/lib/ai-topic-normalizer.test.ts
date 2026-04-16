import { describe, expect, it } from 'vitest';
import { AiGenerationError } from './ai-error';
import {
  normalizeTopicSuggestion,
  normalizeTopicsRequest,
  normalizeTopicsResponse,
} from './ai-topic-normalizer';

const VALID_SUGGESTION = {
  suggestionId: 's1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Filas vs RPC',
  angle: 'Trade-offs',
  summary: 'Resumo',
  targetReader: 'Backend',
  suggestedTagNames: ['BullMQ', 'Redis'],
  rationale: 'Motivo',
};

describe('normalizeTopicsRequest', () => {
  it('trims briefing and excluded ideas', () => {
    const result = normalizeTopicsRequest(
      {
        category: 'backend-arquitetura',
        briefing: '  foco em consistencia eventual  ',
        limit: 4,
        excludedIdeas: ['  tema antigo  ', '   '],
      },
      { maxBriefingChars: 1000, maxSuggestions: 4 }
    );

    expect(result.briefing).toBe('foco em consistencia eventual');
    expect(result.excludedIdeas).toEqual(['tema antigo']);
  });

  it('applies runtime caps to briefing length and suggestion limit', () => {
    const result = normalizeTopicsRequest(
      {
        category: 'backend-arquitetura',
        briefing: 'abcdef',
        limit: 5,
        excludedIdeas: [],
      },
      { maxBriefingChars: 3, maxSuggestions: 3 }
    );

    expect(result.briefing).toBe('abc');
    expect(result.limit).toBe(3);
  });
});

describe('normalizeTopicSuggestion', () => {
  it('trims fields and backfills an empty suggestionId', () => {
    const result = normalizeTopicSuggestion({
      ...VALID_SUGGESTION,
      suggestionId: '   ',
      proposedTitle: '  Filas vs RPC  ',
      angle: '  Trade-offs  ',
      summary: '  Resumo  ',
      targetReader: '  Backend  ',
      rationale: '  Motivo  ',
    });

    expect(result.suggestionId).not.toBe('');
    expect(result.proposedTitle).toBe('Filas vs RPC');
    expect(result.angle).toBe('Trade-offs');
    expect(result.summary).toBe('Resumo');
    expect(result.targetReader).toBe('Backend');
    expect(result.rationale).toBe('Motivo');
  });
});

describe('normalizeTopicsResponse', () => {
  it('deduplicates topic titles by slug before validating', () => {
    const result = normalizeTopicsResponse(
      {
        suggestions: [
          VALID_SUGGESTION,
          { ...VALID_SUGGESTION, suggestionId: 's2', proposedTitle: 'Filas vs. RPC' },
          { ...VALID_SUGGESTION, suggestionId: 's3', proposedTitle: 'Cache distribuido' },
          { ...VALID_SUGGESTION, suggestionId: 's4', proposedTitle: 'Rate limiting' },
        ],
      },
      4
    );

    expect(result.suggestions).toHaveLength(3);
  });

  it('throws validation when deduplication drops below the minimum contract', () => {
    expect(() =>
      normalizeTopicsResponse(
        {
          suggestions: [
            VALID_SUGGESTION,
            { ...VALID_SUGGESTION, suggestionId: 's2', proposedTitle: 'Filas vs. RPC' },
            { ...VALID_SUGGESTION, suggestionId: 's3', proposedTitle: 'Filas vs  RPC' },
          ],
        },
        4
      )
    ).toThrow(AiGenerationError);
  });
});
