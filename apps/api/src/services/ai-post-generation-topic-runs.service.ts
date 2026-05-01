/**
 * AI Post Topic Run service — API side.
 *
 * Provides CRUD operations for the ai_post_generation_topic_runs table.
 * The API creates runs and exposes status; the worker claims and executes them.
 *
 * Transactional Outbox flow:
 *  1. create()    — inserts run + outbox event atomically
 *  2. getStatus() — reads the current run state for polling
 */

import { AI_POST_TOPIC_RUN_INITIAL_POLL_MS } from '@portfolio/shared/constants/ai-posts';
import { OutboxEventType } from '@portfolio/shared/constants/enums';
import type { AiPostTopicRun } from '@portfolio/shared/db/schema';
import { aiPostTopicRuns, outbox } from '@portfolio/shared/db/schema';
import { normalizeTopicsRequest } from '@portfolio/shared/lib/ai-topic-normalizer';
import type {
  CreateTopicRunRequest,
  CreateTopicRunResponse,
  TopicRunStatusResponse,
} from '@portfolio/shared/schemas/ai-post-generation';
import { generateTopicsResponseSchema } from '@portfolio/shared/schemas/ai-post-generation';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
  buildQueuedAiRunResponse,
  createQueuedAiRunWithOutbox,
} from './ai-post-generation-runs.shared';
import { resolveActiveAiTopicGenerationConfig } from './ai-post-generation-settings.service';

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new topic run and emit a transactional outbox event.
 *
 * Returns immediately with the run ID and initial status.
 * The worker picks up the job via the outbox relay and BullMQ.
 */
export async function createTopicRun(
  request: CreateTopicRunRequest,
  createdBy: string
): Promise<CreateTopicRunResponse> {
  // Pre-flight: ensure topics model is configured before accepting the run.
  // This surfaces config errors synchronously rather than failing silently in the worker.
  const activeConfig = await resolveActiveAiTopicGenerationConfig();

  const normalizedRequest = normalizeTopicsRequest(request, {
    maxBriefingChars: env.AI_POSTS_MAX_BRIEFING_CHARS,
    maxSuggestions: env.AI_POSTS_MAX_SUGGESTIONS,
  });

  const run = await db.transaction(async (tx) => {
    return createQueuedAiRunWithOutbox({
      createRun: () =>
        tx
          .insert(aiPostTopicRuns)
          .values({
            status: 'queued',
            stage: 'queued',
            requestedCategory: normalizedRequest.category,
            requestPayload: normalizedRequest as unknown as Record<string, unknown>,
            modelId: activeConfig.topicsModelId,
            createdBy,
            attemptCount: 0,
          })
          .returning()
          .then((rows) => rows[0]),
      insertOutbox: (runId) =>
        tx.insert(outbox).values({
          eventType: OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED,
          payload: { runId },
          status: 'pending',
        }),
      errorMessage: 'Não foi possível criar o run de geração de temas.',
    });
  });

  return buildQueuedAiRunResponse(run, AI_POST_TOPIC_RUN_INITIAL_POLL_MS);
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get the current state of a topic run for polling.
 *
 * Returns null if the run does not exist (caller should 404).
 */
export async function getTopicRunStatus(runId: string): Promise<TopicRunStatusResponse | null> {
  const run = await db.query.aiPostTopicRuns.findFirst({
    where: eq(aiPostTopicRuns.id, runId),
  });

  if (!run) return null;

  return formatTopicRunStatus(run);
}

// ── Format ────────────────────────────────────────────────────────────────────

function formatTopicRunStatus(run: AiPostTopicRun): TopicRunStatusResponse {
  const durationMs =
    run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  const error = run.errorKind
    ? {
        kind: run.errorKind,
        code: run.errorCode ?? null,
        message: run.errorMessage ?? 'Erro desconhecido',
      }
    : null;

  const stage = run.stage as TopicRunStatusResponse['stage'];
  const requestedCategory = run.requestedCategory as TopicRunStatusResponse['requestedCategory'];

  return {
    runId: run.id,
    status: run.status,
    stage,
    requestedCategory,
    modelId: run.modelId ?? null,
    attemptCount: run.attemptCount,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs,
    error,
    result: resolveResult(run.resultPayload),
  };
}

function resolveResult(payload: unknown): TopicRunStatusResponse['result'] {
  if (!payload || typeof payload !== 'object') return null;
  const parsed = generateTopicsResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
