import { describe, expect, it } from 'vitest';
import type { GenerateTopicsRequest } from '../schemas/ai-post-generation';
import { buildTopicsUserPrompt } from './ai-post-prompts';

const BASE_REQUEST: GenerateTopicsRequest = {
  category: 'backend-arquitetura',
  briefing: null,
  limit: 4,
  excludedIdeas: [],
};

describe('buildTopicsUserPrompt', () => {
  it('uses plural noun when limit is greater than 1', () => {
    const prompt = buildTopicsUserPrompt({ ...BASE_REQUEST, limit: 4 });
    expect(prompt).toContain('Gere exatamente 4 sugestões de tema');
    expect(prompt).toContain('Cada sugestão deve ter');
    expect(prompt).not.toContain('1 sugestões');
  });

  it('uses singular noun when limit is exactly 1 (avoids "1 sugestões" grammatical error)', () => {
    const prompt = buildTopicsUserPrompt({ ...BASE_REQUEST, limit: 1 });
    expect(prompt).toContain('Gere exatamente 1 sugestão de tema');
    expect(prompt).toContain('A sugestão deve ter');
    expect(prompt).not.toContain('Cada sugestão');
    expect(prompt).not.toContain('1 sugestões');
  });

  it('includes the briefing when provided', () => {
    const prompt = buildTopicsUserPrompt({
      ...BASE_REQUEST,
      briefing: 'Foco em filas e consistência eventual.',
    });
    expect(prompt).toContain('Briefing do autor:');
    expect(prompt).toContain('Foco em filas e consistência eventual.');
  });

  it('lists excluded ideas when provided', () => {
    const prompt = buildTopicsUserPrompt({
      ...BASE_REQUEST,
      excludedIdeas: ['Introdução a filas', 'O que é Redis'],
    });
    expect(prompt).toContain('Ângulos a evitar');
    expect(prompt).toContain('- Introdução a filas');
    expect(prompt).toContain('- O que é Redis');
  });
});
