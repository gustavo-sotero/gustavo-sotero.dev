'use client';

import type {
  CreateDraftRunRequest,
  CreateDraftRunResponse,
  DraftRunStatusResponse,
  GenerateDraftRequest,
  GenerateDraftResponse,
  GenerateTopicsRequest,
  GenerateTopicsResponse,
} from '@portfolio/shared';
import { AI_POST_DRAFT_RUN_INITIAL_POLL_MS } from '@portfolio/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

/**
 * Mutation hook to generate topic suggestions from the AI assistant.
 *
 * Calls POST /admin/posts/generate/topics — admin-only, CSRF required.
 * Returns { suggestions: TopicSuggestion[] } on success.
 */
export function useGeneratePostTopics() {
  return useMutation<GenerateTopicsResponse, unknown, GenerateTopicsRequest>({
    mutationFn: async (data) => {
      const res = await apiPost<GenerateTopicsResponse>('/admin/posts/generate/topics', data);
      if (!res?.data) {
        throw new Error('A resposta de sugestões veio vazia. Tente novamente.');
      }
      return res.data;
    },
  });
}

/**
 * Mutation hook to generate a complete post draft from an approved suggestion.
 * Calls the synchronous legacy endpoint — kept for compat / fallback.
 *
 * Calls POST /admin/posts/generate/draft — admin-only, CSRF required.
 */
export function useGeneratePostDraft() {
  return useMutation<GenerateDraftResponse, unknown, GenerateDraftRequest>({
    mutationFn: async (data) => {
      const res = await apiPost<GenerateDraftResponse>('/admin/posts/generate/draft', data);
      if (!res?.data) {
        throw new Error('A resposta do draft veio vazia. Tente novamente.');
      }
      return res.data;
    },
  });
}

// ── Async draft run ───────────────────────────────────────────────────────────

/**
 * Mutation that creates an async draft run (POST /draft-runs → 202).
 * Returns the run ID and initial status immediately.
 */
export function useCreateDraftRun() {
  return useMutation<CreateDraftRunResponse, unknown, CreateDraftRunRequest>({
    mutationFn: async (data) => {
      const res = await apiPost<CreateDraftRunResponse>('/admin/posts/generate/draft-runs', data);
      if (!res?.data) {
        throw new Error('Falha ao iniciar a geração assíncrona.');
      }
      return res.data;
    },
  });
}

/**
 * Polling query for a draft run status.
 *
 * Polls every `intervalMs` while the run is in a non-terminal state.
 * Stops automatically when status is 'completed', 'failed', or 'timed_out'.
 */
export function useDraftRunStatus(
  runId: string | null,
  intervalMs = AI_POST_DRAFT_RUN_INITIAL_POLL_MS
) {
  const TERMINAL_STATUSES = ['completed', 'failed', 'timed_out'] as const;
  return useQuery<DraftRunStatusResponse, unknown>({
    queryKey: ['draft-run-status', runId],
    queryFn: async () => {
      const res = await apiGet<DraftRunStatusResponse>(`/admin/posts/generate/draft-runs/${runId}`);
      if (!res?.data) throw new Error('Falha ao buscar status do run.');
      return res.data;
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return intervalMs;
      if (TERMINAL_STATUSES.includes(data.status as (typeof TERMINAL_STATUSES)[number]))
        return false;
      // Adaptive backoff: slower polling after 10s
      const elapsed = Date.now() - new Date(data.createdAt).getTime();
      return elapsed > 10_000 ? 2_000 : intervalMs;
    },
    staleTime: 0,
  });
}

/**
 * Composed hook: creates a draft run, polls until terminal, then returns the
 * completed draft payload.
 *
 * Usage:
 *   const { start, status, draft, error, isPending } = useGeneratePostDraftRun();
 *   await start(request);
 */
export function useGeneratePostDraftRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
  const createMutation = useCreateDraftRun();
  const statusQuery = useDraftRunStatus(runId, pollIntervalMs);
  const onSettledRef = useRef<((run: DraftRunStatusResponse) => void) | null>(null);
  const onErrorRef = useRef<((err: unknown) => void) | null>(null);

  const runStage = statusQuery.data?.stage;

  // Adaptive polling: increase interval when waiting on provider
  useEffect(() => {
    if (runStage === 'requesting-provider') {
      setPollIntervalMs(2_000);
    }
  }, [runStage]);

  // Notify callbacks when terminal state reached
  useEffect(() => {
    const run = statusQuery.data;
    if (!run) return;
    if (run.status === 'completed') {
      onSettledRef.current?.(run);
      onSettledRef.current = null;
    } else if (run.status === 'failed' || run.status === 'timed_out') {
      onErrorRef.current?.(new Error(run.error?.message ?? 'Geração falhou.'));
      onErrorRef.current = null;
    }
  }, [statusQuery.data]);

  const start = useCallback(
    async (
      request: CreateDraftRunRequest,
      callbacks?: {
        onCompleted?: (run: DraftRunStatusResponse) => void;
        onError?: (err: unknown) => void;
      }
    ): Promise<void> => {
      onSettledRef.current = callbacks?.onCompleted ?? null;
      onErrorRef.current = callbacks?.onError ?? null;
      setPollIntervalMs(AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
      const run = await createMutation.mutateAsync(request);
      setRunId(run.runId);
    },
    [createMutation]
  );

  const reset = useCallback(() => {
    setRunId(null);
    setPollIntervalMs(AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
    onSettledRef.current = null;
    onErrorRef.current = null;
  }, []);

  return {
    start,
    reset,
    runId,
    status: statusQuery.data,
    isPending:
      createMutation.isPending ||
      (!!runId &&
        statusQuery.data?.status !== 'completed' &&
        statusQuery.data?.status !== 'failed' &&
        statusQuery.data?.status !== 'timed_out'),
    draft:
      statusQuery.data?.status === 'completed'
        ? (statusQuery.data.result as GenerateDraftResponse | null)
        : null,
    error:
      statusQuery.data?.status === 'failed' || statusQuery.data?.status === 'timed_out'
        ? statusQuery.data.error
        : null,
    stage: statusQuery.data?.stage ?? null,
  };
}
