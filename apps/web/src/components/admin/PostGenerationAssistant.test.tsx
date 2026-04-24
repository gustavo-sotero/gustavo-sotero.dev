import type {
  CreateDraftRunRequest,
  DraftRunStatusResponse,
  TopicRunStatusResponse,
  TopicSuggestion,
} from '@portfolio/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const startTopicRunMock = vi.fn();
const resetTopicRunMock = vi.fn();
const startDraftRunMock = vi.fn();
const useAiPostGenerationConfigMock = vi.fn();

vi.mock('@/hooks/admin/use-ai-post-generation-config', () => ({
  useAiPostGenerationConfig: () => useAiPostGenerationConfigMock(),
}));

vi.mock('@/hooks/admin/use-admin-tags', () => ({
  useResolveAiSuggestedTags: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ data: [] }),
    isPending: false,
  }),
}));

vi.mock('@/hooks/admin/use-post-generation', () => ({
  useGeneratePostTopicsRun: () => ({
    start: startTopicRunMock,
    reset: resetTopicRunMock,
    isPending: false,
    result: null,
    error: null,
    stage: null,
    status: null,
    runId: null,
  }),
  useGeneratePostDraftRun: () => ({
    start: startDraftRunMock,
    reset: vi.fn(),
    isPending: false,
    draft: null,
    error: null,
    stage: null,
    status: null,
    runId: null,
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
    isRegenerating?: boolean;
    resolveAiTags?: (names: string[]) => Promise<number[]>;
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
  imagePrompt: 'Ilustração minimalista representando o tema do post, flat design, formato quadrado',
  linkedinPost:
    'Novo post no blog sobre TypeScript.\n\nhttps://gustavo-sotero.dev/blog/post-gerado\n\n#TypeScript #Backend #NodeJs',
  notes: null,
};

const MERMAID_DRAFT_FIXTURE = {
  ...DRAFT_FIXTURE,
  content:
    '## Fluxo\n\n```mermaid\ngraph TD\n  A[API] --> B[Worker]\n```\n\nConteúdo adicional para manter o markdown completo durante a aplicação no formulário.',
};

// ── Topic run helpers ─────────────────────────────────────────────────────────

type TopicRunCallbacks = {
  onCompleted?: (run: TopicRunStatusResponse) => void;
  onError?: (err: unknown) => void;
};

function buildCompletedTopicRunStatus(suggestions: TopicSuggestion[]): TopicRunStatusResponse {
  return {
    runId: '550e8400-e29b-41d4-a716-446655440001',
    status: 'completed',
    stage: 'completed',
    requestedCategory: 'backend-arquitetura',
    modelId: 'openai/gpt-4o',
    attemptCount: 1,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 1200,
    error: null,
    result: { suggestions },
  };
}

function mockTopicRunCompleted(suggestions: TopicSuggestion[]) {
  startTopicRunMock.mockImplementationOnce((_request: unknown, callbacks?: TopicRunCallbacks) => {
    callbacks?.onCompleted?.(buildCompletedTopicRunStatus(suggestions));
    return Promise.resolve();
  });
}

function mockTopicRunError(error: unknown) {
  startTopicRunMock.mockImplementationOnce((_request: unknown, callbacks?: TopicRunCallbacks) => {
    callbacks?.onError?.(error);
    return Promise.resolve();
  });
}

// ── Draft run helpers ─────────────────────────────────────────────────────────

type DraftRunCallbacks = {
  onCompleted?: (run: DraftRunStatusResponse) => void;
  onError?: (err: unknown) => void;
};

function buildCompletedDraftRunStatus(
  result: typeof DRAFT_FIXTURE | typeof MERMAID_DRAFT_FIXTURE
): DraftRunStatusResponse {
  return {
    runId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'completed',
    stage: 'completed',
    requestedCategory: 'backend-arquitetura',
    selectedSuggestionCategory: 'backend-arquitetura',
    concreteCategory: 'backend-arquitetura',
    modelId: 'openai/gpt-4o',
    attemptCount: 1,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 1200,
    error: null,
    result,
  };
}

function mockDraftRunCompleted(result: typeof DRAFT_FIXTURE | typeof MERMAID_DRAFT_FIXTURE) {
  startDraftRunMock.mockImplementationOnce(
    (_request: CreateDraftRunRequest, callbacks?: DraftRunCallbacks) => {
      callbacks?.onCompleted?.(buildCompletedDraftRunStatus(result));
      return Promise.resolve();
    }
  );
}

function mockDraftRunError(error: unknown) {
  startDraftRunMock.mockImplementationOnce(
    (_request: CreateDraftRunRequest, callbacks?: DraftRunCallbacks) => {
      callbacks?.onError?.(error);
      return Promise.resolve();
    }
  );
}

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

    // Default: config is ready and valid so generation is allowed
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

  it('renders Misto as an explicit selectable category', () => {
    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    expect(screen.getByRole('option', { name: /Misto/i })).toBeInTheDocument();
  });

  it('calls start() with correct payload when generating topics', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));

    await waitFor(() => {
      expect(startTopicRunMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'backend-arquitetura' }),
        expect.any(Object)
      );
    });
  });

  it('shows topic list after successful topic generation', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);

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
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(DRAFT_FIXTURE);

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
    mockTopicRunError({ message: 'Serviço indisponível' });

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
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(DRAFT_FIXTURE);

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
    // Topics run start should have been called exactly once (initial fetch, no re-fetch on back)
    expect(startTopicRunMock).toHaveBeenCalledTimes(1);
  });

  it('regenerate draft start() is called twice (guard allows draftReady state)', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(DRAFT_FIXTURE);
    mockDraftRunCompleted({ ...DRAFT_FIXTURE, title: 'Regenerated Post' });

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
      // Draft start should have been called twice (initial + regenerate)
      expect(startDraftRunMock).toHaveBeenCalledTimes(2);
    });

    const secondCallArgs = startDraftRunMock.mock.calls[1]?.[0] as {
      rejectedAngles: string[];
    };
    expect(secondCallArgs.rejectedAngles).toContain(SUGGESTION_FIXTURE.angle);
  });

  it('clears rejected angles when returning to topics before selecting a different suggestion', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE, SECOND_SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(DRAFT_FIXTURE);
    mockDraftRunCompleted({ ...DRAFT_FIXTURE, title: 'Draft regenerado' });
    mockDraftRunCompleted({ ...DRAFT_FIXTURE, title: 'Draft do segundo tema' });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));

    // Select first topic and regenerate once to accumulate a rejected angle
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));
    fireEvent.click(screen.getByTestId('regenerate-draft'));
    await waitFor(() => expect(startDraftRunMock).toHaveBeenCalledTimes(2));

    // Go back to topics — this should clear the accumulated rejected angles
    fireEvent.click(screen.getByTestId('back-to-topics'));
    await waitFor(() => screen.getByTestId('topic-list'));

    // Select the second topic
    fireEvent.click(screen.getByTestId('topic-1'));
    await waitFor(() => screen.getByTestId('draft-review'));

    // The third draft call should have empty rejectedAngles (cleared when switching topics)
    const thirdCallArgs = startDraftRunMock.mock.calls[2]?.[0] as {
      rejectedAngles: string[];
      selectedSuggestion: { suggestionId: string };
    };
    expect(thirdCallArgs.rejectedAngles).toEqual([]);
    expect(thirdCallArgs.selectedSuggestion.suggestionId).toBe(
      SECOND_SUGGESTION_FIXTURE.suggestionId
    );
  });

  it('applies mermaid markdown to the form without altering the draft content', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(MERMAID_DRAFT_FIXTURE);

    const { setValueMock } = renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));
    fireEvent.click(screen.getByTestId('topic-0'));
    await waitFor(() => screen.getByTestId('draft-review'));

    fireEvent.click(screen.getByTestId('apply-all'));

    await waitFor(() => {
      // The mermaid content should be passed to setValue as-is (not transformed)
      expect(setValueMock).toHaveBeenCalledWith('content', MERMAID_DRAFT_FIXTURE.content);
    });
  });

  it('passes accumulated excluded ideas on topic regeneration (no stale closure)', async () => {
    // Set up two successive topic-run completions
    mockTopicRunCompleted([SUGGESTION_FIXTURE]); // initial
    mockTopicRunCompleted([
      { ...SUGGESTION_FIXTURE, suggestionId: 's2', proposedTitle: 'Outro tema' },
    ]); // regenerate

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
      expect(startTopicRunMock).toHaveBeenCalledTimes(2);
    });

    // The second call should include the first suggestion's title in excludedIdeas,
    // proving the fix for the stale-closure bug where setExcludedIdeas was called
    // but handleGenerateTopics still read the old empty array.
    const secondCallArgs = startTopicRunMock.mock.calls[1]?.[0] as { excludedIdeas: string[] };
    expect(secondCallArgs.excludedIdeas).toContain(SUGGESTION_FIXTURE.proposedTitle);
  });

  it('draft error preserves topic context and shows back-to-topics button', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunError({ message: 'AI timeout' });

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
    // Topic run start should have been called exactly once (no re-fetch on recovery)
    expect(startTopicRunMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected suggestion visible and allows retrying the same draft after an error', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunError({ message: 'AI timeout' });
    mockDraftRunCompleted(DRAFT_FIXTURE);

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));
    fireEvent.change(screen.getByTestId('category-select'), {
      target: { value: 'backend-arquitetura' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sugerir temas/i }));
    await waitFor(() => screen.getByTestId('topic-0'));

    fireEvent.click(screen.getByTestId('topic-0'));

    await waitFor(() => {
      expect(screen.getByText(/AI timeout/i)).toBeInTheDocument();
      expect(screen.getAllByText(SUGGESTION_FIXTURE.proposedTitle).length).toBeGreaterThanOrEqual(
        2
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente com este tema/i }));

    await waitFor(() => {
      expect(screen.getByTestId('draft-review')).toBeInTheDocument();
    });

    expect(startDraftRunMock).toHaveBeenCalledTimes(2);
    // Topic run start should have been called only once (no new topic generation on draft retry)
    expect(startTopicRunMock).toHaveBeenCalledTimes(1);
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
        issues: ['Catálogo temporariamente indisponível.'],
        updatedAt: null,
        updatedBy: null,
        catalogFetchedAt: null,
      },
      isLoading: false,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole('button', { name: /Assistente de geração/i }));

    expect(screen.getByText(/último par de modelos validado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revisar configuração/i })).toBeInTheDocument();
    // Category select must be visible — generation is allowed in catalog-unavailable
    expect(screen.getByTestId('category-select')).toBeInTheDocument();
  });

  it('discarding a generated draft returns the assistant to the idle step', async () => {
    mockTopicRunCompleted([SUGGESTION_FIXTURE]);
    mockDraftRunCompleted(DRAFT_FIXTURE);

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
