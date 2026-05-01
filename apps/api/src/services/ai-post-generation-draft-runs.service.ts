/**
 * AI Post Draft Run service — API side.
 *
 * Provides CRUD operations for the ai_post_generation_draft_runs table.
 * The API creates runs and exposes status; the worker claims and executes them.
 *
 * Transactional Outbox flow:
 *  1. create()    — inserts run + outbox event atomically
 *  2. getStatus() — reads the current run state for polling
 */

import { AI_POST_DRAFT_RUN_INITIAL_POLL_MS } from '@portfolio/shared/constants/ai-posts';
import { OutboxEventType } from '@portfolio/shared/constants/enums';
import type { AiPostDraftRun } from '@portfolio/shared/db/schema';
import { aiPostDraftRuns, outbox, tags } from '@portfolio/shared/db/schema';
import { normalizeDraftRequest } from '@portfolio/shared/lib/ai-draft-normalizer';
import type { PersistedTagForNormalization } from '@portfolio/shared/lib/aiTagNormalizer';
import type {
  CreateDraftRunRequest,
  CreateDraftRunResponse,
  DraftRunStatusResponse,
} from '@portfolio/shared/schemas/ai-post-generation';
import { generateDraftResponseSchema } from '@portfolio/shared/schemas/ai-post-generation';
import { asc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import {
  buildQueuedAiRunResponse,
  createQueuedAiRunWithOutbox,
} from './ai-post-generation-runs.shared';
import { resolveActiveAiDraftGenerationConfig } from './ai-post-generation-settings.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadPersistedTagsForNormalization(): Promise<PersistedTagForNormalization[]> {
  return db.select({ name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name));
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new draft run and emit a transactional outbox event.
 *
 * Returns immediately with the run ID and initial status.
 * The worker picks up the job via the outbox relay and BullMQ.
 */
export async function createDraftRun(
  request: CreateDraftRunRequest,
  createdBy: string
): Promise<CreateDraftRunResponse> {
  // Pre-flight: ensure the feature is configured before accepting the run.
  // This surfaces config errors synchronously rather than failing silently in the worker.
  const [activeConfig, persistedTags] = await Promise.all([
    resolveActiveAiDraftGenerationConfig(),
    loadPersistedTagsForNormalization(),
  ]);

  const normalizedRequest = normalizeDraftRequest(request, persistedTags);
  const requestedCategory = normalizedRequest.category;
  const concreteCategory = normalizedRequest.selectedSuggestion.category;

  const run = await db.transaction(async (tx) => {
    return createQueuedAiRunWithOutbox({
      createRun: () =>
        tx
          .insert(aiPostDraftRuns)
          .values({
            status: 'queued',
            stage: 'queued',
            requestedCategory,
            concreteCategory,
            requestPayload: normalizedRequest as unknown as Record<string, unknown>,
            modelId: activeConfig.draftModelId,
            createdBy,
            attemptCount: 0,
          })
          .returning()
          .then((rows) => rows[0]),
      insertOutbox: (runId) =>
        tx.insert(outbox).values({
          eventType: OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED,
          payload: { runId },
          status: 'pending',
        }),
      errorMessage: 'Não foi possível criar o run de geração de draft.',
    });
  });

  return buildQueuedAiRunResponse(run, AI_POST_DRAFT_RUN_INITIAL_POLL_MS);
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get the current state of a draft run for polling.
 *
 * Returns null if the run does not exist (caller should 404).
 */
export async function getDraftRunStatus(runId: string): Promise<DraftRunStatusResponse | null> {
  const run = await db.query.aiPostDraftRuns.findFirst({
    where: eq(aiPostDraftRuns.id, runId),
  });

  if (!run) return null;

  return formatDraftRunStatus(run);
}

// ── Format ────────────────────────────────────────────────────────────────────

function formatDraftRunStatus(run: AiPostDraftRun): DraftRunStatusResponse {
  const durationMs =
    run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  const error = run.errorKind
    ? {
        kind: run.errorKind,
        code: run.errorCode ?? null,
        message: run.errorMessage ?? 'Erro desconhecido',
      }
    : null;

  const stage = run.stage as DraftRunStatusResponse['stage'];
  const requestedCategory = run.requestedCategory as DraftRunStatusResponse['requestedCategory'];
  const selectedSuggestionCategory =
    (run.concreteCategory as DraftRunStatusResponse['selectedSuggestionCategory']) ?? null;

  return {
    runId: run.id,
    status: run.status,
    stage,
    requestedCategory,
    selectedSuggestionCategory,
    concreteCategory: selectedSuggestionCategory,
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

/**
 * Revalidates the persisted result payload against the current draft schema.
 * Returns null for missing, invalid, or historically incomplete payloads
 * (e.g. rows written before the linkedinPost field was introduced).
 */
function resolveResult(rawPayload: unknown): DraftRunStatusResponse['result'] {
  if (rawPayload == null) return null;
  const parsed = generateDraftResponseSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  return parsed.data;
}
