import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────
const apiGetMock = vi.fn();
const apiGetPaginatedMock = vi.fn();
const apiPutMock = vi.fn();
const useAdminMutationMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiGetPaginated: (...args: unknown[]) => apiGetPaginatedMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
}));

vi.mock('@/hooks/admin/mutation', () => ({
  useAdminMutation: (opts: unknown) => useAdminMutationMock(opts),
}));

vi.mock('@/hooks/admin/query-keys', () => ({
  adminKeys: {
    aiPostGenerationConfig: () => ['admin', 'ai-post-generation', 'config'],
    aiPostGenerationModels: (params?: unknown) => ['admin', 'ai-post-generation', 'models', params],
  },
}));

import {
  useAiPostGenerationConfig,
  useAiPostGenerationModels,
  useUpdateAiPostGenerationConfig,
} from './use-ai-post-generation-config';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG_STATE = {
  featureEnabled: true,
  status: 'ready',
  config: {
    topicsModelId: 'openai/gpt-4o',
    draftModelId: 'openai/gpt-4o',
    topicsRouting: { mode: 'low-latency', preferredMaxLatencySeconds: 10 },
    draftRouting: {
      mode: 'manual',
      providerOrder: ['anthropic', 'openai'],
      allowFallbacks: false,
    },
  },
  issues: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'admin',
  catalogFetchedAt: '2026-01-01T00:00:00.000Z',
};

const PAGINATED_MODELS = {
  data: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', supportsStructuredOutputs: true },
    { id: 'anthropic/claude-3-5', name: 'Claude 3.5', supportsStructuredOutputs: true },
  ],
  meta: { page: 1, perPage: 20, total: 2, totalPages: 1 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('use-ai-post-generation-config hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── useAiPostGenerationConfig ─────────────────────────────────────────────

  describe('useAiPostGenerationConfig', () => {
    it('fetches config state from GET /admin/posts/generate/config', async () => {
      apiGetMock.mockResolvedValueOnce({ data: CONFIG_STATE });

      const { result } = renderHook(() => useAiPostGenerationConfig(), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiGetMock).toHaveBeenCalledWith('/admin/posts/generate/config');
      expect(result.current.data?.status).toBe('ready');
    });

    it('surfaces error state when the API call fails', async () => {
      apiGetMock.mockRejectedValueOnce(new Error('network error'));

      const { result } = renderHook(() => useAiPostGenerationConfig(), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useAiPostGenerationModels ─────────────────────────────────────────────

  describe('useAiPostGenerationModels', () => {
    it('fetches models from GET /admin/posts/generate/models with default params', async () => {
      apiGetPaginatedMock.mockResolvedValueOnce(PAGINATED_MODELS);

      const { result } = renderHook(() => useAiPostGenerationModels(), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiGetPaginatedMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/posts/generate/models')
      );
      expect(result.current.data?.data).toHaveLength(2);
    });

    it('includes search query param when q is provided', async () => {
      apiGetPaginatedMock.mockResolvedValueOnce(PAGINATED_MODELS);

      renderHook(() => useAiPostGenerationModels({ q: 'claude', page: 1, perPage: 20 }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(apiGetPaginatedMock).toHaveBeenCalledWith(expect.stringContaining('q=claude'));
      });
    });

    it('includes forceRefresh param when provided', async () => {
      apiGetPaginatedMock.mockResolvedValueOnce(PAGINATED_MODELS);

      renderHook(() => useAiPostGenerationModels({ forceRefresh: true }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(apiGetPaginatedMock).toHaveBeenCalledWith(
          expect.stringContaining('forceRefresh=true')
        );
      });
    });
  });

  // ── useUpdateAiPostGenerationConfig ──────────────────────────────────────

  describe('useUpdateAiPostGenerationConfig', () => {
    it('delegates to useAdminMutation with PUT to /admin/posts/generate/config', () => {
      const mutateFnCapture = { fn: undefined as unknown };
      useAdminMutationMock.mockImplementation((opts: { mutationFn: unknown }) => {
        mutateFnCapture.fn = opts.mutationFn;
        return { mutate: vi.fn(), isPending: false };
      });

      renderHook(() => useUpdateAiPostGenerationConfig(), { wrapper: makeWrapper() });

      expect(useAdminMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          invalidate: [['admin', 'ai-post-generation', 'config']],
        })
      );
    });

    it('calls apiPut with correct URL and payload', () => {
      useAdminMutationMock.mockImplementation((opts: { mutationFn: (d: unknown) => unknown }) => {
        // Invoke the mutationFn directly to verify the API call shape
        opts.mutationFn({
          topicsModelId: 'openai/gpt-4o',
          draftModelId: 'openai/gpt-4o',
          topicsRouting: { mode: 'low-latency', preferredMaxLatencySeconds: 10 },
          draftRouting: {
            mode: 'manual',
            providerOrder: ['anthropic', 'openai'],
            allowFallbacks: false,
          },
        });
        return { mutate: vi.fn(), isPending: false };
      });

      renderHook(() => useUpdateAiPostGenerationConfig(), { wrapper: makeWrapper() });

      expect(apiPutMock).toHaveBeenCalledWith('/admin/posts/generate/config', {
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'openai/gpt-4o',
        topicsRouting: { mode: 'low-latency', preferredMaxLatencySeconds: 10 },
        draftRouting: {
          mode: 'manual',
          providerOrder: ['anthropic', 'openai'],
          allowFallbacks: false,
        },
      });
    });
  });
});
