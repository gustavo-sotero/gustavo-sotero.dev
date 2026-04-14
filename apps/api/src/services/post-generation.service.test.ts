import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { generateStructuredObjectMock, envMock } = vi.hoisted(() => ({
  generateStructuredObjectMock: vi.fn(),
  envMock: {
    AI_POSTS_ENABLED: true,
    AI_POSTS_MODEL_TOPICS: 'gpt-4o-mini',
    AI_POSTS_MODEL_DRAFT: 'gpt-4o-mini',
    AI_POSTS_TIMEOUT_MS: 30_000,
    AI_POSTS_MAX_SUGGESTIONS: 4,
    AI_POSTS_MAX_BRIEFING_CHARS: 1_000,
  },
}));

vi.mock('../config/env', () => ({ env: envMock }));

vi.mock('../lib/ai/generateStructuredObject', async () => {
  const actual = await vi.importActual<typeof import('../lib/ai/generateStructuredObject')>(
    '../lib/ai/generateStructuredObject'
  );
  return {
    ...actual,
    generateStructuredObject: generateStructuredObjectMock,
  };
});

import { AiGenerationError } from '../lib/ai/generateStructuredObject';
import { generatePostDraft, generateTopicSuggestions } from './post-generation.service';

const VALID_SUGGESTION = {
  suggestionId: 'abc1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Fila não é solução mágica',
  angle: 'Trade-offs de filas em produção',
  summary: 'Por que fila resolve um problema e cria outros.',
  targetReader: 'Engenheiros backend com 2-5 anos',
  suggestedTagNames: ['BullMQ', 'Redis', 'Node.js'],
  rationale: 'Tema prático e recorrente.',
};

describe('post-generation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.AI_POSTS_ENABLED = true;
    envMock.AI_POSTS_MAX_SUGGESTIONS = 4;
    envMock.AI_POSTS_MAX_BRIEFING_CHARS = 1_000;
  });

  // ── generateTopicSuggestions ────────────────────────────────────────────────

  describe('generateTopicSuggestions', () => {
    it('returns normalised suggestions on success', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            { ...VALID_SUGGESTION, suggestionId: 'abc2', proposedTitle: 'Segundo tema' },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Terceiro tema' },
          ],
        },
        durationMs: 1200,
        inputTokens: 100,
        outputTokens: 300,
      });

      const result = await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(result.suggestions).toHaveLength(3);
      // biome-ignore lint/style/noNonNullAssertion: length asserted above
      expect(result.suggestions[0]!.proposedTitle).toBe('Fila não é solução mágica');
    });

    it('asks the model for a rationale in each topic suggestion', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            { ...VALID_SUGGESTION, suggestionId: 'abc2', proposedTitle: 'Segundo tema' },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Terceiro tema' },
          ],
        },
        durationMs: 900,
        inputTokens: 110,
        outputTokens: 220,
      });

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('rationale (1 frase curta)'),
        })
      );
    });

    it('deduplicates suggestions while preserving the 3-item minimum contract', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            {
              ...VALID_SUGGESTION,
              suggestionId: 'dup',
              proposedTitle: 'Fila Não É Solução Mágica',
            },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Outro tema único' },
            { ...VALID_SUGGESTION, suggestionId: 'abc4', proposedTitle: 'Terceiro tema único' },
          ],
        },
        durationMs: 800,
        inputTokens: 90,
        outputTokens: 200,
      });

      const result = await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 4,
        excludedIdeas: [],
      });

      expect(result.suggestions).toHaveLength(3);
    });

    it('throws validation when deduplication drops the payload below 3 suggestions', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            {
              ...VALID_SUGGESTION,
              suggestionId: 'dup',
              proposedTitle: 'Fila Não É Solução Mágica',
            },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Outro tema único' },
          ],
        },
        durationMs: 800,
        inputTokens: 90,
        outputTokens: 200,
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
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          suggestions: [
            VALID_SUGGESTION,
            { ...VALID_SUGGESTION, suggestionId: 'abc2', proposedTitle: 'Segundo tema' },
            { ...VALID_SUGGESTION, suggestionId: 'abc3', proposedTitle: 'Terceiro tema' },
          ],
        },
        durationMs: 1200,
        inputTokens: 100,
        outputTokens: 300,
      });

      await generateTopicSuggestions({
        category: 'backend-arquitetura',
        briefing: null,
        limit: 5,
        excludedIdeas: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Gere exatamente 3 sugestões'),
        })
      );
    });

    it('throws AiGenerationError with kind=timeout on timeout', async () => {
      generateStructuredObjectMock.mockRejectedValue(
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

    it('throws when AI_POSTS_ENABLED is false', async () => {
      envMock.AI_POSTS_ENABLED = false;

      await expect(
        generateTopicSuggestions({
          category: 'backend-arquitetura',
          briefing: null,
          limit: 4,
          excludedIdeas: [],
        })
      ).rejects.toMatchObject({ code: 'DISABLED' });
    });
  });

  // ── generatePostDraft ───────────────────────────────────────────────────────

  describe('generatePostDraft', () => {
    it('returns a normalised draft on success', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Fila não é solução mágica — é troca',
          slug: 'fila-nao-e-solucao-magica',
          excerpt: 'Você coloca algo numa fila porque não quer pagar o custo agora.',
          content:
            '## Introdução\n\nFila não é solução mágica.\n\n```typescript\nconst queue = new Queue();\n```\n\nTexto longo o suficiente para passar a validação mínima de 100 chars.',
          suggestedTagNames: ['BullMQ', 'Redis', 'bullmq'],
          imagePrompt: 'Minimalist dark illustration of a queue data structure',
          notes: null,
        },
        durationMs: 3000,
        inputTokens: 500,
        outputTokens: 900,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.title).toBe('Fila não é solução mágica — é troca');
      expect(result.slug).toBe('fila-nao-e-solucao-magica');
      // Deduplication: 'BullMQ' and 'bullmq' are the same
      expect(result.suggestedTagNames).toHaveLength(2);
      expect(result.imagePrompt).toBeTruthy();
    });

    it('tells the model to use Mermaid only when a diagram adds real value', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Fila não é solução mágica — é troca',
          slug: 'fila-nao-e-solucao-magica',
          excerpt: 'Você coloca algo numa fila porque não quer pagar o custo agora.',
          content:
            '## Introdução\n\nFila não é solução mágica.\n\n```typescript\nconst queue = new Queue();\n```\n\nTexto longo o suficiente para passar a validação mínima de 100 chars.',
          suggestedTagNames: ['BullMQ', 'Redis'],
          imagePrompt: 'Minimalist dark illustration of a queue data structure',
          notes: null,
        },
        durationMs: 1800,
        inputTokens: 420,
        outputTokens: 710,
      });

      await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(generateStructuredObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('não force diagramas'),
        })
      );
    });

    it('normalises slug from title when provider returns empty slug', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Título do Post Gerado',
          slug: '',
          excerpt: 'Resumo do post.',
          content:
            'Conteúdo longo o suficiente para não falhar na validação mínima de cem caracteres totais aqui nesta string de teste.',
          suggestedTagNames: [],
          imagePrompt: 'dark illustration',
          notes: null,
        },
        durationMs: 2000,
        inputTokens: 400,
        outputTokens: 700,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.slug).toBe('titulo-do-post-gerado');
    });

    it('strips markdown wrappers from content', async () => {
      const rawContent =
        '```markdown\n## Título\n\nConteúdo longo o suficiente para não falhar na validação mínima de cem caracteres totais aqui nesta string mais comprida.\n```';

      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content: rawContent,
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 2000,
        inputTokens: 400,
        outputTokens: 700,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).not.toMatch(/^```/);
      expect(result.content).not.toMatch(/```\s*$/);
    });

    it('preserves a leading mermaid fence when the draft starts with a diagram', async () => {
      const rawContent =
        '```mermaid\ngraph TD\n  A[API] --> B[Worker]\n```\n\n## Trade-offs\n\nConteúdo longo o suficiente para não falhar na validação mínima de cem caracteres totais e manter o bloco Mermaid no início do markdown.';

      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post com Mermaid inicial',
          slug: 'post-com-mermaid-inicial',
          excerpt: 'Resumo.',
          content: rawContent,
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 2000,
        inputTokens: 320,
        outputTokens: 410,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content.startsWith('```mermaid')).toBe(true);
      expect(result.content).toContain('A[API] --> B[Worker]');
    });

    it('preserves a trailing fenced block when the draft ends with code', async () => {
      const rawContent =
        "## Encerramento\n\nConteúdo longo o suficiente para ultrapassar a validação mínima antes de um bloco final de código.\n\n```typescript\nawait queue.add('notify', payload);\n```";

      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post com código final',
          slug: 'post-com-codigo-final',
          excerpt: 'Resumo.',
          content: rawContent,
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1900,
        inputTokens: 280,
        outputTokens: 360,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).toContain('```typescript');
      expect(result.content.trim().endsWith('```')).toBe(true);
    });

    it('preserves mermaid code fences in markdown content', async () => {
      const mermaidContent =
        '## Fluxo\n\n```mermaid\ngraph TD\n  A[API] --> B[Worker]\n  B --> C[PostgreSQL]\n```\n\nConteúdo adicional suficiente para ultrapassar a validação mínima e garantir que o markdown com diagrama continue intacto.';

      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post com Mermaid',
          slug: 'post-com-mermaid',
          excerpt: 'Resumo.',
          content: mermaidContent,
          suggestedTagNames: ['BullMQ'],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1800,
        inputTokens: 260,
        outputTokens: 320,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).toContain('```mermaid');
      expect(result.content).toContain('graph TD');
      expect(result.content).toContain('A[API] --> B[Worker]');
    });

    it('rejects inline HTML placeholders such as manual Mermaid markup', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content:
            '## Fluxo\n\n<div class="mermaid">graph TD; A-->B</div>\n\nConteúdo adicional suficiente para ultrapassar a validação mínima de tamanho do draft e cobrir esse cenário de teste.',
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1600,
        inputTokens: 220,
        outputTokens: 180,
      });

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('rejects inline script tags outside fenced code blocks', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content:
            '## Fluxo\n\n<script>alert("xss")</script>\n\nConteúdo adicional suficiente para ultrapassar a validação mínima de tamanho do draft e cobrir esse cenário de teste.',
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1500,
        inputTokens: 200,
        outputTokens: 160,
      });

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('rejects multiline HTML tags outside fenced code blocks', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content:
            '## Fluxo\n\n<div\n  class="mermaid"\n  data-content="graph TD; A-->B;"\n></div>\n\nConteúdo adicional suficiente para ultrapassar a validação mínima de tamanho do draft e cobrir esse cenário de tag HTML multilinha.',
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1500,
        inputTokens: 210,
        outputTokens: 170,
      });

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('ignores HTML-looking text when it is inside a fenced code block', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content:
            '## Exemplo\n\n```html\n<div class="mermaid">graph TD; A-->B</div>\n```\n\nConteúdo adicional suficiente para ultrapassar a validação mínima de tamanho do draft e garantir que HTML em código continue permitido.',
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1700,
        inputTokens: 240,
        outputTokens: 210,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.content).toContain('<div class="mermaid">');
    });

    it('throws AiGenerationError with kind=validation when content is too short', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content: 'Curto.',
          suggestedTagNames: [],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1500,
        inputTokens: 100,
        outputTokens: 50,
      });

      await expect(
        generatePostDraft({
          category: 'backend-arquitetura',
          briefing: null,
          selectedSuggestion: VALID_SUGGESTION,
          rejectedAngles: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' });
    });

    it('throws AiGenerationError with kind=refusal on refusal', async () => {
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

    it('deduplicates suggested tag names using slug normalization', async () => {
      generateStructuredObjectMock.mockResolvedValueOnce({
        object: {
          title: 'Post Válido',
          slug: 'post-valido',
          excerpt: 'Resumo.',
          content:
            '## Introdução\n\nConteúdo suficientemente longo para ultrapassar a validação mínima e verificar a deduplicação slug-aware de tags sugeridas pelo modelo.',
          suggestedTagNames: ['Arquitetura Assíncrona', 'arquitetura assincrona', 'BullMQ'],
          imagePrompt: 'illustration',
          notes: null,
        },
        durationMs: 1500,
        inputTokens: 220,
        outputTokens: 180,
      });

      const result = await generatePostDraft({
        category: 'backend-arquitetura',
        briefing: null,
        selectedSuggestion: VALID_SUGGESTION,
        rejectedAngles: [],
      });

      expect(result.suggestedTagNames).toEqual(['Arquitetura Assíncrona', 'BullMQ']);
    });
  });
});
