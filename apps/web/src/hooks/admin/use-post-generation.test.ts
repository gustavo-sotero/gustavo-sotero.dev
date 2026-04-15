import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock, apiPostMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

// Make useMutation and useQuery plain passthroughs so hooks can be tested
// outside a full React context for the mutation-only cases.
vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: { mutationFn: (...args: unknown[]) => unknown }) => ({
    mutationFn: opts.mutationFn,
    mutateAsync: (...args: unknown[]) => opts.mutationFn(args[0]),
    isPending: false,
    isError: false,
  }),
  useQuery: (opts: {
    queryFn: (...args: unknown[]) => unknown;
    enabled?: boolean;
    refetchInterval?: unknown;
    queryKey?: unknown;
    staleTime?: number;
  }) => ({
    queryFn: opts.queryFn,
    enabled: opts.enabled,
    refetchInterval: opts.refetchInterval,
    data: undefined,
    isLoading: false,
    isError: false,
  }),
}));

import {
  useCreateDraftRun,
  useDraftRunStatus,
  useGeneratePostDraft,
  useGeneratePostDraftRun,
  useGeneratePostTopics,
} from './use-post-generation';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function callMutationFn<TData, TVariables>(
  hookFn: unknown,
  vars: TVariables
): Promise<TData> {
  const result = (hookFn as () => { mutationFn: (v: TVariables) => Promise<TData> })();
  return result.mutationFn(vars);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_SUGGESTION = {
  suggestionId: 's1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Fila não é solução mágica',
  angle: 'Trade-offs',
  summary: 'Resumo.',
  targetReader: 'Dev backend',
  suggestedTagNames: ['BullMQ'],
  rationale: 'Tema recorrente.',
};

const TOPICS_REQUEST = {
  category: 'backend-arquitetura' as const,
  briefing: null,
  limit: 4,
  excludedIdeas: [],
};

const DRAFT_REQUEST = {
  category: 'backend-arquitetura' as const,
  briefing: null,
  selectedSuggestion: VALID_SUGGESTION,
  rejectedAngles: [],
};

const TOPICS_RESPONSE = {
  suggestions: [VALID_SUGGESTION],
};

const DRAFT_RESPONSE = {
  title: 'Fila não é solução mágica',
  slug: 'fila-nao-e-solucao-magica',
  excerpt: 'Resumo curto.',
  content: '## Intro\n\nConteúdo.',
  suggestedTagNames: ['BullMQ'],
  imagePrompt: 'dark illustration',
  linkedinPost:
    'Post sobre BullMQ e filas. https://gustavo-sotero.dev/blog/fila-nao-e-solucao-magica\n\n#BullMQ #Redis #Nodejs',
  notes: null,
};

const CREATE_RUN_REQUEST = {
  category: 'backend-arquitetura' as const,
  briefing: null,
  selectedSuggestion: VALID_SUGGESTION,
  rejectedAngles: [],
};

const RUN_ID = '550e8400-e29b-41d4-a716-446655440000';

const CREATE_RUN_RESPONSE = {
  runId: RUN_ID,
  status: 'queued' as const,
  stage: 'queued' as const,
  pollAfterMs: 1000,
  createdAt: new Date().toISOString(),
};

const RUN_STATUS_QUEUED = {
  runId: RUN_ID,
  status: 'running' as const,
  stage: 'requesting-provider' as const,
  requestedCategory: 'backend-arquitetura',
  selectedSuggestionCategory: 'backend-arquitetura',
  concreteCategory: 'backend-arquitetura',
  modelId: 'openai/gpt-4o',
  attemptCount: 1,
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  finishedAt: null,
  durationMs: null,
  error: null,
  result: null,
};

const RUN_STATUS_COMPLETED = {
  ...RUN_STATUS_QUEUED,
  status: 'completed' as const,
  stage: 'persisting-result' as const,
  finishedAt: new Date().toISOString(),
  durationMs: 12000,
  result: DRAFT_RESPONSE,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGeneratePostTopics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /admin/posts/generate/topics with the request payload', async () => {
    apiPostMock.mockResolvedValueOnce({ data: TOPICS_RESPONSE });

    await callMutationFn(useGeneratePostTopics, TOPICS_REQUEST);

    expect(apiPostMock).toHaveBeenCalledWith('/admin/posts/generate/topics', TOPICS_REQUEST);
  });

  it('returns the suggestions from the response envelope', async () => {
    apiPostMock.mockResolvedValueOnce({ data: TOPICS_RESPONSE });

    const result = await callMutationFn(useGeneratePostTopics, TOPICS_REQUEST);

    expect(result).toEqual(TOPICS_RESPONSE);
  });

  it('throws when the response has no data', async () => {
    apiPostMock.mockResolvedValueOnce({ data: null });

    await expect(callMutationFn(useGeneratePostTopics, TOPICS_REQUEST)).rejects.toThrow(
      'A resposta de sugestões veio vazia. Tente novamente.'
    );
  });

  it('propagates network errors from apiPost', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(callMutationFn(useGeneratePostTopics, TOPICS_REQUEST)).rejects.toThrow(
      'Network error'
    );
  });
});

describe('useGeneratePostDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /admin/posts/generate/draft with the request payload', async () => {
    apiPostMock.mockResolvedValueOnce({ data: DRAFT_RESPONSE });

    await callMutationFn(useGeneratePostDraft, DRAFT_REQUEST);

    expect(apiPostMock).toHaveBeenCalledWith('/admin/posts/generate/draft', DRAFT_REQUEST);
  });

  it('returns the draft from the response envelope', async () => {
    apiPostMock.mockResolvedValueOnce({ data: DRAFT_RESPONSE });

    const result = await callMutationFn(useGeneratePostDraft, DRAFT_REQUEST);

    expect(result).toEqual(DRAFT_RESPONSE);
  });

  it('throws when the response has no data', async () => {
    apiPostMock.mockResolvedValueOnce({ data: null });

    await expect(callMutationFn(useGeneratePostDraft, DRAFT_REQUEST)).rejects.toThrow(
      'A resposta do draft veio vazia. Tente novamente.'
    );
  });

  it('propagates provider error response from apiPost', async () => {
    apiPostMock.mockRejectedValueOnce({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'AI provider timed out' },
    });

    await expect(callMutationFn(useGeneratePostDraft, DRAFT_REQUEST)).rejects.toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});

// ── useCreateDraftRun ─────────────────────────────────────────────────────────

describe('useCreateDraftRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /admin/posts/generate/draft-runs with the request payload', async () => {
    apiPostMock.mockResolvedValueOnce({ data: CREATE_RUN_RESPONSE });

    await callMutationFn(useCreateDraftRun, CREATE_RUN_REQUEST);

    expect(apiPostMock).toHaveBeenCalledWith(
      '/admin/posts/generate/draft-runs',
      CREATE_RUN_REQUEST
    );
  });

  it('returns the run creation response from the envelope', async () => {
    apiPostMock.mockResolvedValueOnce({ data: CREATE_RUN_RESPONSE });

    const result = await callMutationFn(useCreateDraftRun, CREATE_RUN_REQUEST);

    expect(result).toEqual(CREATE_RUN_RESPONSE);
  });

  it('throws when the response has no data', async () => {
    apiPostMock.mockResolvedValueOnce({ data: null });

    await expect(callMutationFn(useCreateDraftRun, CREATE_RUN_REQUEST)).rejects.toThrow(
      'Falha ao iniciar a geração assíncrona.'
    );
  });
});

// ── useDraftRunStatus ─────────────────────────────────────────────────────────

describe('useDraftRunStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when runId is null', () => {
    const result = useDraftRunStatus(null);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    expect((result as any).enabled).toBe(false);
  });

  it('is enabled when a runId is provided', () => {
    const result = useDraftRunStatus(RUN_ID);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    expect((result as any).enabled).toBe(true);
  });

  it('fetches run status via GET /admin/posts/generate/draft-runs/:id', async () => {
    apiGetMock.mockResolvedValueOnce({ data: RUN_STATUS_QUEUED });

    const result = useDraftRunStatus(RUN_ID);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    const data = await (result as any).queryFn();

    expect(apiGetMock).toHaveBeenCalledWith(`/admin/posts/generate/draft-runs/${RUN_ID}`);
    expect(data).toEqual(RUN_STATUS_QUEUED);
  });

  it('throws when the response has no data', async () => {
    apiGetMock.mockResolvedValueOnce({ data: null });

    const result = useDraftRunStatus(RUN_ID);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    await expect((result as any).queryFn()).rejects.toThrow('Falha ao buscar status do run.');
  });

  it('stops polling (returns false) when status is completed', () => {
    const result = useDraftRunStatus(RUN_ID, 1000);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    const interval = (result as any).refetchInterval({
      state: { data: { ...RUN_STATUS_COMPLETED, status: 'completed' } },
    });
    expect(interval).toBe(false);
  });

  it('stops polling (returns false) when status is failed', () => {
    const result = useDraftRunStatus(RUN_ID, 1000);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    const interval = (result as any).refetchInterval({
      state: { data: { ...RUN_STATUS_QUEUED, status: 'failed' } },
    });
    expect(interval).toBe(false);
  });

  it('continues polling at the initial cadence while the run is younger than 20s', () => {
    const result = useDraftRunStatus(RUN_ID, 500);
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    const interval = (result as any).refetchInterval({
      state: { data: { ...RUN_STATUS_QUEUED, createdAt: new Date().toISOString() } },
    });
    expect(typeof interval).toBe('number');
    expect(interval).toBe(500);
  });

  it('backs off polling after the run has been active for more than 20s', () => {
    const result = useDraftRunStatus(RUN_ID, 500);
    const oldCreatedAt = new Date(Date.now() - 21_000).toISOString();
    // biome-ignore lint/suspicious/noExplicitAny: test helper accessing mocked internals
    const interval = (result as any).refetchInterval({
      state: { data: { ...RUN_STATUS_QUEUED, createdAt: oldCreatedAt } },
    });
    expect(interval).toBe(2000);
  });
});

// ── useGeneratePostDraftRun ───────────────────────────────────────────────────

describe('useGeneratePostDraftRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes start() / reset() / runId in initial state', () => {
    const { result } = renderHook(() => useGeneratePostDraftRun());

    expect(result.current.runId).toBeNull();
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('sets runId after start() resolves', async () => {
    apiPostMock.mockResolvedValueOnce({ data: CREATE_RUN_RESPONSE });

    const { result } = renderHook(() => useGeneratePostDraftRun());

    await act(async () => {
      await result.current.start(CREATE_RUN_REQUEST);
    });

    expect(result.current.runId).toBe(RUN_ID);
  });

  it('calls POST /draft-runs with the provided request on start()', async () => {
    apiPostMock.mockResolvedValueOnce({ data: CREATE_RUN_RESPONSE });

    const { result } = renderHook(() => useGeneratePostDraftRun());

    await act(async () => {
      await result.current.start(CREATE_RUN_REQUEST);
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/admin/posts/generate/draft-runs',
      CREATE_RUN_REQUEST
    );
  });

  it('clears runId after reset()', async () => {
    apiPostMock.mockResolvedValueOnce({ data: CREATE_RUN_RESPONSE });

    const { result } = renderHook(() => useGeneratePostDraftRun());

    await act(async () => {
      await result.current.start(CREATE_RUN_REQUEST);
    });

    expect(result.current.runId).toBe(RUN_ID);

    act(() => {
      result.current.reset();
    });

    expect(result.current.runId).toBeNull();
  });
});
