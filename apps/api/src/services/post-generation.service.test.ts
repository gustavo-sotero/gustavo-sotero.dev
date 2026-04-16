import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({
  env: {
    AI_POSTS_TIMEOUT_MS: 30_000,
    AI_POSTS_MAX_SUGGESTIONS: 4,
    AI_POSTS_MAX_BRIEFING_CHARS: 1_000,
  },
}));

import { env } from '../config/env';
import * as aiModule from '../lib/ai/generateStructuredObject';
import { AiGenerationError } from '../lib/ai/generateStructuredObject';
import * as tagsRepo from '../repositories/tags.repo';
import * as settingsService from './ai-post-generation-settings.service';
import { generatePostDraft, generateTopicSuggestions } from './post-generation.service';

const envMock = env;
let generateStructuredObjectMock: ReturnType<typeof vi.fn>;
let resolveActiveTopicConfigMock: ReturnType<typeof vi.fn>;
let resolveActiveDraftConfigMock: ReturnType<typeof vi.fn>;
let findAllTagsForNormalizationMock: ReturnType<typeof vi.fn>;

const VALID_SUGGESTION = {
  suggestionId: 'abc1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Fila nao e solucao magica',
  angle: 'Trade-offs de filas em producao',
  summary: 'Por que fila resolve um problema e cria outros.',
  targetReader: 'Engenheiros backend com 2-5 anos',
  suggestedTagNames: ['BullMQ', 'Redis', 'Node.js'],
  rationale: 'Tema pratico e recorrente.',
};

function makeTopicResult(overrides?: Array<typeof VALID_SUGGESTION>) {
  const suggestions = overrides ?? [
    VALID_SUGGESTION,
    { ...VALID_SUGGESTION, suggestionId: 'abc2', proposedTitle: 'Segundo tema' },
    { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Terceiro tema' },
  ];

  return {
    object: { suggestions },
    durationMs: 1200,
    inputTokens: 100,
    outputTokens: 300,
    providerGenerationId: null,
  };
}

function makeDraftResult(
  overrides: Partial<{
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    suggestedTagNames: string[];
    imagePrompt: string;
    linkedinPost: string;
    notes: string | null;
  }> = {}
) {
  return {
    object: {
      title: 'Fila nao e solucao magica - e troca',
      slug: 'fila-nao-e-solucao-magica',
      excerpt: 'Voce coloca algo numa fila porque nao quer pagar o custo agora.',
      content:
        '## Introducao\n\nFila nao e solucao magica.\n\n```typescript\nconst queue = new Queue();\n```\n\nTexto longo o suficiente para passar a validacao minima de 100 chars.',
      suggestedTagNames: ['BullMQ', 'Redis', 'bullmq'],
      imagePrompt: 'Minimalist dark illustration of a queue data structure',
      linkedinPost: '{{POST_URL}}',
      notes: null,
      ...overrides,
    },
    durationMs: 3000,
    inputTokens: 500,
    outputTokens: 900,
    providerGenerationId: null,
  };
}

describe('post-generation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateStructuredObjectMock = vi
      .spyOn(aiModule, 'generateStructuredObject')
      .mockImplementation(vi.fn());
    resolveActiveTopicConfigMock = vi
      .spyOn(settingsService, 'resolveActiveAiTopicGenerationConfig')
      .mockImplementation(vi.fn());
    resolveActiveDraftConfigMock = vi
      .spyOn(settingsService, 'resolveActiveAiDraftGenerationConfig')
      .mockImplementation(vi.fn());
    findAllTagsForNormalizationMock = vi
      .spyOn(tagsRepo, 'findAllTagsForNormalization')
      .mockImplementation(vi.fn());

    resolveActiveTopicConfigMock.mockResolvedValue({ topicsModelId: 'openai/gpt-4o' });
    resolveActiveDraftConfigMock.mockResolvedValue({ draftModelId: 'openai/gpt-4o' });
    findAllTagsForNormalizationMock.mockResolvedValue([]);
    envMock.AI_POSTS_TIMEOUT_MS = 30_000;
    envMock.AI_POSTS_MAX_SUGGESTIONS = 4;
    envMock.AI_POSTS_MAX_BRIEFING_CHARS = 1_000;
  });

  describe('generateTopicSuggestions', () => {
    it('returns normalized suggestions on success', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeTopicResult());

      const result = await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0]?.proposedTitle).toBe('Fila nao e solucao magica');
      expect(resolveActiveDraftConfigMock).not.toHaveBeenCalled();
    });

    it('asks for rationale and passes explicit timeout/retry policy', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeTopicResult());

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('rationale (1 frase curta)'),
          timeoutMs: 30_000,
          maxRetries: 0,
        })
      );
    });

    it('deduplicates suggestions while preserving the minimum contract', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            {
              ...VALID_SUGGESTION,
              suggestionId: 'dup',
              proposedTitle: 'Fila Nao E Solucao Magica',
            },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Outro tema unico' },
            { ...VALID_SUGGESTION, suggestionId: 'abc4', proposedTitle: 'Terceiro tema unico' },
          ],
        },
        durationMs: 800,
        inputTokens: 90,
        outputTokens: 200,
        providerGenerationId: null,
      });

      const result = await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(result.suggestions).toHaveLength(3);
    });

    it('throws validation when deduplication drops below three items', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            {
              ...VALID_SUGGESTION,
              suggestionId: 'dup',
              proposedTitle: 'Fila Nao E Solucao Magica',
            },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Outro tema unico' },
          ],
        },
        durationMs: 800,
        inputTokens: 90,
        outputTokens: 200,
        providerGenerationId: null,
      });

      await expect(
        generateTopicSuggestions({
          category: 'backend-arquitetura',
          briefing: null,
          limit: 4,
          excludedIdeas: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('clamps requested suggestion count to the runtime env cap', async () => {
      envMock.AI_POSTS_MAX_SUGGESTIONS = 3;
      generateStructuredObjectMock.mockResolvedValueOnce(makeTopicResult());

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 5,
        excludedIdeas: [],
      });

      const callArg = generateStructuredObjectMock.mock.calls[0]?.[0] as
        | { prompt?: string }
        | undefined;
      expect(callArg?.prompt).toContain('Gere exatamente 3 sugestões');
    });

    it('throws timeout errors from the AI helper', async () => {
      generateStructuredObjectMock.mockRejectedValueOnce(
        new AiGenerationError('timeout', 'Provider timed out')
      );

      await expect(
        generateTopicSuggestions({
          category: 'backend-arquitetura',
          briefing: null,
          limit: 4,
          excludedIdeas: [],
        })
      ).rejects.toMatchObject({ kind: 'timeout' });
    });

    it('propagates DISABLED and NOT_CONFIGURED from the topic resolver', async () => {
      resolveActiveTopicConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('disabled'), { code: 'DISABLED' })
      );
      await expect(
        generateTopicSuggestions({
          category: 'backend-arquitetura',
          briefing: null,
          limit: 4,
          excludedIdeas: [],
        })
      ).rejects.toMatchObject({ code: 'DISABLED' });

      resolveActiveTopicConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('not configured'), { code: 'NOT_CONFIGURED' })
      );
      await expect(
        generateTopicSuggestions({
          category: 'backend-arquitetura',
          briefing: null,
          limit: 4,
          excludedIdeas: [],
        })
      ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    });

    it('uses the persisted topics model from the topic resolver', async () => {
      resolveActiveTopicConfigMock.mockResolvedValueOnce({
        topicsModelId: 'anthropic/claude-3-haiku',
      });
      generateStructuredObjectMock.mockResolvedValueOnce(makeTopicResult());

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'anthropic/claude-3-haiku' })
      );
    });

    it('keeps tag coherence guidance in the topics system prompt', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeTopicResult());

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      const callArg = generateStructuredObjectMock.mock.calls[0]?.[0] as
        | { system?: string }
        | undefined;
      expect(callArg?.system).toMatch(/tags? diretamente relevante|generica|slug/i);
    });
  });

  describe('generatePostDraft', () => {
    it('returns a normalized draft on success', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult());

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.title).toBe('Fila nao e solucao magica - e troca');
      expect(result.slug).toBe('fila-nao-e-solucao-magica');
      expect(result.suggestedTagNames).toHaveLength(2);
      expect(result.imagePrompt).toBeTruthy();
      expect(result.linkedinPost).toContain(
        'https://gustavo-sotero.dev/blog/fila-nao-e-solucao-magica'
      );
      expect(result.linkedinPost).toMatch(/#\w+/);
      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 30_000, maxRetries: 0 })
      );
      expect(resolveActiveTopicConfigMock).not.toHaveBeenCalled();
    });

    it('keeps Mermaid guidance in the system prompt', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult());

      await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      const callArg = generateStructuredObjectMock.mock.calls[0]?.[0] as
        | { system?: string }
        | undefined;
      expect(callArg?.system).toContain('não force diagramas');
    });

    it('normalizes slug from title when provider returns an empty slug', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          title: 'Titulo do Post Gerado',
          slug: '',
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.slug).toBe('titulo-do-post-gerado');
    });

    it('strips markdown wrappers from content', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          content:
            '```markdown\n## Titulo\n\nConteudo longo o suficiente para nao falhar na validacao minima de cem caracteres totais aqui nesta string mais comprida.\n```',
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).not.toMatch(/^```/);
      expect(result.content).not.toMatch(/```\s*$/);
    });

    it('preserves mermaid fences in markdown content', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          content:
            '## Fluxo\n\n```mermaid\ngraph TD\n  A[API] --> B[Worker]\n```\n\nConteudo adicional suficiente para ultrapassar a validacao minima e garantir que o markdown com diagrama continue intacto.',
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).toContain('```mermaid');
      expect(result.content).toContain('A[API] --> B[Worker]');
    });

    it('rejects inline HTML placeholders and scripts outside fenced code blocks', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          content:
            '## Fluxo\n\n<div class="mermaid">graph TD; A-->B</div>\n\nConteudo adicional suficiente para ultrapassar a validacao minima de tamanho do draft e cobrir esse cenario de teste.',
        })
      );

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });

      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          content:
            '## Fluxo\n\n<script>alert("xss")</script>\n\nConteudo adicional suficiente para ultrapassar a validacao minima de tamanho do draft e cobrir esse cenario de teste.',
        })
      );

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('ignores HTML-like text when it is inside fenced code blocks', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          content:
            '## Exemplo\n\n```html\n<div class="mermaid">graph TD; A-->B</div>\n```\n\nConteudo adicional suficiente para ultrapassar a validacao minima de tamanho do draft e garantir que HTML em codigo continue permitido.',
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).toContain('<div class="mermaid">');
    });

    it('throws validation when content is too short or linkedinPost is blank', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult({ content: 'Curto.' }));

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });

      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult({ linkedinPost: '   ' }));

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('throws refusal errors from the AI helper', async () => {
      generateStructuredObjectMock.mockRejectedValueOnce(
        new AiGenerationError('refusal', 'Model refused')
      );

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'refusal' });
    });

    it('deduplicates and canonicalizes suggested tag names', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          suggestedTagNames: ['Arquitetura Assincrona', 'arquitetura assincrona', 'BullMQ'],
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.suggestedTagNames).toEqual(['Arquitetura Assincrona', 'BullMQ']);
    });

    it('prefers persisted tag casing when canonicalizing suggestions', async () => {
      findAllTagsForNormalizationMock.mockResolvedValueOnce([
        { name: 'Postgres (custom)', slug: 'postgres-custom' },
      ]);

      generateStructuredObjectMock.mockResolvedValueOnce(
        makeDraftResult({
          suggestedTagNames: ['postgres-custom'],
        })
      );

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.suggestedTagNames).toEqual(['Postgres (custom)']);
    });

    it('propagates DISABLED and NOT_CONFIGURED from the draft resolver', async () => {
      resolveActiveDraftConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('disabled'), { code: 'DISABLED' })
      );
      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ code: 'DISABLED' });

      resolveActiveDraftConfigMock.mockRejectedValueOnce(
        Object.assign(new Error('not configured'), { code: 'NOT_CONFIGURED' })
      );
      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    });

    it('uses the persisted draft model from the draft resolver', async () => {
      resolveActiveDraftConfigMock.mockResolvedValueOnce({
        draftModelId: 'anthropic/claude-sonnet-4-5',
      });
      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult());

      await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'anthropic/claude-sonnet-4-5' })
      );
    });

    it('includes image and linkedin guidance in the prompts', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce(makeDraftResult());

      await generatePostDraft({
        category: 'misto',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      const callArg = generateStructuredObjectMock.mock.calls[0]?.[0] as
        | { system?: string; prompt?: string }
        | undefined;

      expect(callArg?.system).toMatch(/PT-BR|portugues/i);
      expect(callArg?.system).toMatch(/minimalista|elegante|1:1|4:3|thumb/i);
      expect(callArg?.system).toContain('{{POST_URL}}');
      expect(callArg?.system).toMatch(/hashtag/i);
      expect(callArg?.system).toContain("nunca retorne 'misto' como categoria do item");
      expect(callArg?.prompt).toContain('{{POST_URL}}');
      expect(callArg?.prompt).toMatch(/hashtag/i);
    });
  });
});
