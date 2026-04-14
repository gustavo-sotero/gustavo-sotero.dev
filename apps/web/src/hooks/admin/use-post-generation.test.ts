import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

// Make useMutation a plain passthrough so hooks can be called outside React.
// We only care about testing the mutationFn logic, not TanStack internals.
vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: { mutationFn: (...args: unknown[]) => unknown }) => ({
    mutationFn: opts.mutationFn,
  }),
}));

import { useGeneratePostDraft, useGeneratePostTopics } from './use-post-generation';

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
  notes: null,
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
      'Empty response from topics endpoint'
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
      'Empty response from draft endpoint'
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
