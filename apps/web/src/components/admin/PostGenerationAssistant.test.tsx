import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mutateAsyncTopicsMock = vi.fn();
const mutateAsyncDraftMock = vi.fn();
const useAiPostGenerationConfigMock = vi.fn();

vi.mock('@/hooks/admin/use-ai-post-generation-config', () => ({
  useAiPostGenerationConfig: () => useAiPostGenerationConfigMock(),
}));

vi.mock('@/hooks/admin/use-post-generation', () => ({
  useGeneratePostTopics: () => ({
    mutateAsync: mutateAsyncTopicsMock,
    isPending: false,
  }),
  useGeneratePostDraft: () => ({
    mutateAsync: mutateAsyncDraftMock,
    isPending: false,
  }),
}));

// Replace Radix Select with simple <select> for testing
vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      data-testid="category-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/components/admin/PostTopicSuggestionList', () => ({
  PostTopicSuggestionList: ({
    topics,
    onSelect,
    onRegenerate,
    onReset,
  }: {
    topics: unknown[];
    onSelect: (t: unknown) => void;
    onRegenerate: () => void;
    onReset: () => void;
    isRegenerating: boolean;
  }) => (
    <div data-testid="topic-list">
      {topics.map((s: unknown, i) => {
        const suggestion = s as { proposedTitle: string };
        return (
          <button
            type="button"
            key={suggestion.proposedTitle}
            onClick={() => onSelect(s)}
            data-testid={`topic-${i}`}
          >
            {suggestion.proposedTitle}
          </button>
        );
      })}
      <button type="button" onClick={onRegenerate} data-testid="regenerate-topics">
        Outros temas
      </button>
      <button type="button" onClick={onReset} data-testid="reset-topics">
        Voltar
      </button>
    </div>
  ),
}));

vi.mock('@/components/admin/PostDraftReview', () => ({
  PostDraftReview: ({
    draft,
    onApplyAll,
    onRegenerate,
    onBackToTopics,
    onDiscard,
  }: {
    draft: { title: string; slug: string; excerpt: string; content: string };
    allTags: unknown[];
    currentValues: unknown;
    onApplyAll: (fields: {
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      tagIds: number[];
    }) => void;
    onRegenerate: () => void;
    onBackToTopics: () => void;
    onDiscard: () => void;
    setValue: unknown;
    onTagsApplied?: (ids: number[]) => void;
  }) => (
    <div data-testid="draft-review">
      <button
        type="button"
        onClick={() =>
          onApplyAll({
            title: draft.title,
            slug: draft.slug,
            excerpt: draft.excerpt,
            content: draft.content,
            tagIds: [1],
          })
        }
        data-testid="apply-all"
      >
        Aplicar tudo
      </button>
      <button type="button" onClick={onRegenerate} data-testid="regenerate-draft">
        Regerar rascunho
      </button>
      <button type="button" onClick={onBackToTopics} data-testid="back-to-topics">
        Voltar para temas
      </button>
      <button type="button" onClick={onDiscard} data-testid="discard-draft">
        Descartar
      </button>
    </div>
  ),
}));

import { PostGenerationAssistant } from './PostGenerationAssistant';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TAG_FIXTURES = [
  {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'language' as const,
    iconKey: null,
    isHighlighted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const SUGGESTION_FIXTURE = {
  suggestionId: 's1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Fila não é solução mágica',
  angle: 'Trade-offs',
  summary: 'Resumo do tema.',
  targetReader: 'Engenheiro backend',
  suggestedTagNames: ['TypeScript'],
  rationale: 'Porque sim.',
};

const SECOND_SUGGESTION_FIXTURE = {
  suggestionId: 's2',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Outbox não é justificativa para tudo',
  angle: 'Quando consistência eventual vale o custo',
  summary: 'Resumo do segundo tema.',
  targetReader: 'Engenheiro backend sênior',
  suggestedTagNames: ['TypeScript'],
  rationale: 'Outro recorte editorial.',
};

const DRAFT_FIXTURE = {
  title: 'Post Gerado',
  slug: 'post-gerado',
  excerpt: 'Resumo curto.',
  content: '## Intro\n\nConteúdo.',
  suggestedTagNames: ['TypeScript'],
  imagePrompt: 'dark illustration',
  notes: null,
};

const MERMAID_DRAFT_FIXTURE = {
  ...DRAFT_FIXTURE,
  content:
    '## Fluxo\n\n```mermaid\ngraph TD\n  A[API] --> B[Worker]\n```\n\nConteúdo adicional para manter o markdown completo durante a aplicação no formulário.',
};

function renderAssistant() {
  const setValueMock = vi.fn();
  const onTagsAppliedMock = vi.fn();
  const utils = render(
    <PostGenerationAssistant
      setValue={setValueMock}
      allTags={TAG_FIXTURES}
      currentValues={{ title: '', slug: '', excerpt: '', content: '', tagIds: [] }}
      onTagsApplied={onTagsAppliedMock}
    />
  );
  return { ...utils, setValueMock, onTagsAppliedMock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostGenerationAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: feature is ready
    useAiPostGenerationConfigMock.mockReturnValue({
      data: {
        status: 'ready',
        config: { topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' },
        featureEnabled: true,
        issues: [],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders collapsed by default with header text', () => {
    renderAssistant();
    expect(screen.getByText(/Assistente de geração/i)).toBeInTheDocument();
    // Body should not be visible
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
  });

  it('expands body when header is clicked', () => {
    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    expect(screen.getByTestId('category-select')).toBeInTheDocument();
  });

  it('generate button is disabled until category is selected', () => {
    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    const generateBtn = screen.getByRole('button', { name: /Sugerir temas/i });
    expect(generateBtn).toBeDisabled();
  });

  it('calls mutateAsync with correct payload when generating topics', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    // Select a category
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    await waitFor(() => {
      expect(mutateAsyncTopicsMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'backend-arquitetura' })
      );
    });
  });

  it('shows topic list after successful topic generation', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    await waitFor(() => {
      expect(screen.getByTestId('topic-list')).toBeInTheDocument();
    });
  });

  it('shows draft review after selecting a topic', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock.mockResolvedValueOnce(DRAFT_FIXTURE);

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    // Wait for topics to appear, then click on topic-0
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));

    await waitFor(() => {
      expect(screen.getByTestId('draft-review')).toBeInTheDocument();
    });
  });

  it('shows error message when topics generation fails', async () => {
    mutateAsyncTopicsMock.mockRejectedValueOnce({ message: 'Serviço indisponível' });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    await waitFor(() => {
      expect(screen.getByText(/Serviço indisponível/i)).toBeInTheDocument();
    });
  });

  it('restores topic list (no extra API call) when back-to-topics is clicked from draft review', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock.mockResolvedValueOnce(DRAFT_FIXTURE);

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    // Clicking back-to-topics should restore the topic list without hitting the API again
    fireEvent.click(screen.getByTestId('back-to-topics'));

    await waitFor(() => {
      expect(screen.getByTestId('topic-list')).toBeInTheDocument();
    });
    // Topics mutation should have been called exactly once (initial fetch, no re-fetch on back)
    expect(mutateAsyncTopicsMock).toHaveBeenCalledTimes(1);
  });

  it('regenerate draft calls mutateAsync (guard allows draftReady state)', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock
      .mockResolvedValueOnce(DRAFT_FIXTURE) // initial draft
      .mockResolvedValueOnce({ ...DRAFT_FIXTURE, title: 'Regenerated Post' }); // regenerated

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    // Click regenerate — this validates the draftReady-state guard is relaxed
    fireEvent.click(screen.getByTestId('regenerate-draft'));

    await waitFor(() => {
      // Draft mutation should have been called twice (initial + regenerate)
      expect(mutateAsyncDraftMock).toHaveBeenCalledTimes(2);
    });

    const secondCallArgs = mutateAsyncDraftMock.mock.calls[1]?.[0] as {
      rejectedAngles: string[];
    };
    expect(secondCallArgs.rejectedAngles).toContain(SUGGESTION_FIXTURE.angle);
  });

  it('clears rejected angles when returning to topics before selecting a different suggestion', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({
      suggestions: [SUGGESTION_FIXTURE, SECOND_SUGGESTION_FIXTURE],
    });
    mutateAsyncDraftMock
      .mockResolvedValueOnce(DRAFT_FIXTURE)
      .mockResolvedValueOnce({ ...DRAFT_FIXTURE, title: 'Draft regenerado' })
      .mockResolvedValueOnce({ ...DRAFT_FIXTURE, title: 'Draft do segundo tema' });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    fireEvent.click(screen.getByTestId('regenerate-draft'));
    await waitFor(() => {
      expect(mutateAsyncDraftMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByTestId('back-to-topics'));
    await waitFor(() => {
      expect(screen.getByTestId('topic-list')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('topic-1'));

    await waitFor(() => {
      expect(mutateAsyncDraftMock).toHaveBeenCalledTimes(3);
    });

    const thirdCallArgs = mutateAsyncDraftMock.mock.calls[2]?.[0] as {
      rejectedAngles: string[];
      selectedSuggestion: { suggestionId: string };
    };
    expect(thirdCallArgs.selectedSuggestion.suggestionId).toBe(
      SECOND_SUGGESTION_FIXTURE.suggestionId
    );
    expect(thirdCallArgs.rejectedAngles).toEqual([]);
  });

  it('applies mermaid markdown to the form without altering the draft content', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock.mockResolvedValueOnce(MERMAID_DRAFT_FIXTURE);

    const { setValueMock, onTagsAppliedMock } = renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    fireEvent.click(screen.getByTestId('apply-all'));

    expect(setValueMock).toHaveBeenCalledWith('content', MERMAID_DRAFT_FIXTURE.content);
    expect(onTagsAppliedMock).toHaveBeenCalledWith([1]);
  });

  it('passes accumulated excluded ideas on topic regeneration (no stale closure)', async () => {
    mutateAsyncTopicsMock
      .mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] }) // initial
      .mockResolvedValueOnce({
        suggestions: [{ ...SUGGESTION_FIXTURE, suggestionId: 's2', proposedTitle: 'Outro tema' }],
      }); // regenerate

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-list'));

    // Click the "Outros temas" (regenerate) button rendered by the mock
    fireEvent.click(screen.getByTestId('regenerate-topics'));

    await waitFor(() => {
      expect(mutateAsyncTopicsMock).toHaveBeenCalledTimes(2);
    });

    // The second call should include the first suggestion's title in excludedIdeas,
    // proving the fix for the stale-closure bug where setExcludedIdeas was called
    // but handleGenerateTopics still read the old empty array.
    const secondCallArgs = mutateAsyncTopicsMock.mock.calls[1]?.[0] as { excludedIdeas: string[] };
    expect(secondCallArgs.excludedIdeas).toContain(SUGGESTION_FIXTURE.proposedTitle);
  });

  it('draft error preserves topic context and shows back-to-topics button', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock.mockRejectedValueOnce({ message: 'AI timeout' });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));

    // Select a topic — this triggers draft generation which will fail
    fireEvent.click(screen.getByTestId('topic-0'));

    // Error state should display the error message
    await waitFor(() => {
      expect(screen.getByText(/AI timeout/i)).toBeInTheDocument();
    });

    // Should show a "Voltar para temas" button since topics were loaded
    const backBtn = screen.getByRole('button', { name: /Voltar para temas/i });
    expect(backBtn).toBeInTheDocument();

    // Clicking it should restore the topic list without a new API call
    fireEvent.click(backBtn);
    await waitFor(() => {
      expect(screen.getByTestId('topic-list')).toBeInTheDocument();
    });
    // Topics mutation should have been called exactly once (no re-fetch on recovery)
    expect(mutateAsyncTopicsMock).toHaveBeenCalledTimes(1);
  });

  // ── Config state gating ────────────────────────────────────────────────────

  it('shows disabled notice and blocks generation when status is disabled', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: {
        status: 'disabled',
        config: null,
        featureEnabled: false,
        issues: ['Desabilitado.'],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    expect(screen.getByText(/desabilitada/i)).toBeInTheDocument();
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
  });

  it('shows configure CTA when status is not-configured', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: {
        status: 'not-configured',
        config: null,
        featureEnabled: true,
        issues: [],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    expect(screen.getByText(/Nenhum modelo configurado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configurar modelos/i })).toBeInTheDocument();
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
  });

  it('shows invalid config warning and configure link when status is invalid-config', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: {
        status: 'invalid-config',
        config: { topicsModelId: 'old/model', draftModelId: 'old/model' },
        featureEnabled: true,
        issues: ['Modelo inválido.'],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    expect(screen.getByText(/configuração de modelos é inválida/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configurar modelos/i })).toBeInTheDocument();
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
  });

  it('shows loading skeleton while config is being fetched', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    // Skeleton is rendered, not the category selector or gating messages
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
    expect(screen.queryByText(/desabilitada/i)).not.toBeInTheDocument();
  });

  it('allows generation when status is catalog-unavailable (resilient degraded state)', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: {
        status: 'catalog-unavailable',
        config: { topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' },
        featureEnabled: true,
        issues: [],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    // Category select must be visible — generation is allowed in catalog-unavailable
    expect(screen.getByTestId('category-select')).toBeInTheDocument();
  });

  it('discarding a generated draft returns the assistant to the idle step', async () => {
    mutateAsyncTopicsMock.mockResolvedValueOnce({ suggestions: [SUGGESTION_FIXTURE] });
    mutateAsyncDraftMock.mockResolvedValueOnce(DRAFT_FIXTURE);

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    fireEvent.click(screen.getByTestId('discard-draft'));

    await waitFor(() => {
      expect(screen.queryByTestId('draft-review')).not.toBeInTheDocument();
      expect(screen.getByTestId('category-select')).toBeInTheDocument();
    });
  });
});
