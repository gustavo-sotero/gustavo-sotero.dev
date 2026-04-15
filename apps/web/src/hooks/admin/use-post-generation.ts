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

const TERMINAL_STATUSES = ['completed', 'failed', 'timed_out'] as const;
const SLOW_POLLING_AFTER_MS = 20_000;
const SLOW_POLLING_INTERVAL_MS = 2_000;

function isTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]);
}

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
      if (isTerminalStatus(data.status)) return false;
      const elapsed = Date.now() - new Date(data.createdAt).getTime();
      return elapsed > SLOW_POLLING_AFTER_MS ? SLOW_POLLING_INTERVAL_MS : intervalMs;
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
  const [initialPollAfterMs, setInitialPollAfterMs] = useState(AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
  const [runSnapshot, setRunSnapshot] = useState<Pick<
    CreateDraftRunResponse,
    'runId' | 'status' | 'stage'
  > | null>(null);
  const createMutation = useCreateDraftRun();
  const statusQuery = useDraftRunStatus(runId, initialPollAfterMs);
  const onSettledRef = useRef<((run: DraftRunStatusResponse) => void) | null>(null);
  const onErrorRef = useRef<((err: unknown) => void) | null>(null);

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
      const run = await createMutation.mutateAsync(request);
      setInitialPollAfterMs(run.pollAfterMs);
      setRunSnapshot({ runId: run.runId, status: run.status, stage: run.stage });
      setRunId(run.runId);
    },
    [createMutation]
  );

  const reset = useCallback(() => {
    setRunId(null);
    setInitialPollAfterMs(AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
    setRunSnapshot(null);
    onSettledRef.current = null;
    onErrorRef.current = null;
  }, []);

  const currentStatus = statusQuery.data?.status ?? runSnapshot?.status ?? null;
  const currentStage = statusQuery.data?.stage ?? runSnapshot?.stage ?? null;

  return {
    start,
    reset,
    runId,
    status: currentStatus,
    run: statusQuery.data,
    isPending: createMutation.isPending || (!!runId && !isTerminalStatus(currentStatus)),
    draft:
      statusQuery.data?.status === 'completed'
        ? (statusQuery.data.result as GenerateDraftResponse | null)
        : null,
    error:
      statusQuery.data?.status === 'failed' || statusQuery.data?.status === 'timed_out'
        ? statusQuery.data.error
        : null,
    stage: currentStage,
  };
}
