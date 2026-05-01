/**
 * AI Post Draft Generation Job
 *
 * Processes async AI draft generation runs created via POST /admin/posts/generate/draft-runs.
 *
 * Flow:
 *  1. Load run record (guard: must be in 'queued' status)
 *  2. Claim run atomically (queued → running)
 *  3. Progress through stages with heartbeat updates
 *  4. Generate draft via OpenRouter AI provider
 *  5. Normalize and canonicalize output
 *  6. Persist result (running → completed) or error (→ failed/timed_out)
 */

import type { AiPostDraftRunStage } from '@portfolio/shared/constants/ai-posts';
import { aiPostDraftRuns } from '@portfolio/shared/db/schema';
import { normalizeDraftResponse } from '@portfolio/shared/lib/ai-draft-normalizer';
import {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
} from '@portfolio/shared/lib/ai-post-prompts';
import { generateDraftOutputSchema } from '@portfolio/shared/schemas/ai-post-generation';
import { type Job, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { generateStructuredObject } from '../lib/ai/generateStructuredObject';
import { resolveAiJobFailure } from '../lib/ai-job-utils';
import {
  claimQueuedAiRun,
  loadAiProviderRoutingConfig,
  loadPersistedTagsForNormalization,
  markAiRunMissingModelId,
  setAiRunStage,
} from '../lib/ai-run-support';

const logger = getLogger('worker', 'jobs', 'ai-post-draft-generation');
const ASYNC_AI_GENERATION_MAX_RETRIES = 0;

export interface AiPostDraftJobData {
  runId: string;
}

export async function processAiPostDraftGeneration(job: Job<AiPostDraftJobData>): Promise<void> {
  const { runId } = job.data;
  const jobMeta = { jobId: job.id, runId };
  const attemptCount = (job.attemptsMade ?? 0) + 1;

  logger.info('AI draft generation job started', jobMeta);

  // ── Stage: resolving-config ────────────────────────────────────────────────
  // Load the run record and claim it atomically (queued → running).
  const claimed = await claimQueuedAiRun<{
    modelId: string | null;
    requestPayload: {
      category: string;
      briefing: string | null;
      selectedSuggestion: {
        proposedTitle: string;
        angle: string;
        summary: string;
        targetReader: string;
        suggestedTagNames: string[];
        category: string;
        suggestionId: string;
        rationale: string;
      };
      rejectedAngles: string[];
    };
  }>(aiPostDraftRuns, runId, attemptCount);

  if (!claimed) {
    // Run was already claimed (concurrent relay delivery or manual intervention)
    logger.warn('AI draft job: run already claimed or not in queued status', jobMeta);
    return;
  }

  const modelId = claimed.modelId;
  if (!modelId) {
    await markAiRunMissingModelId(aiPostDraftRuns, runId);
    logger.error('AI draft job: run has no modelId', jobMeta);
    return;
  }

  const requestPayload = claimed.requestPayload;
  const requestedCategory = requestPayload.category;
  const selectedSuggestionCategory = requestPayload.selectedSuggestion.category;
  let providerGenerationId: string | null = null;

  const draftRouting = await loadAiProviderRoutingConfig('draft');

  try {
    // ── Stage: building-prompt ───────────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'building-prompt');

    const systemPrompt = buildDraftSystemPrompt(requestPayload.category);
    const userPrompt = buildDraftUserPrompt(
      requestPayload as Parameters<typeof buildDraftUserPrompt>[0]
    );

    // ── Stage: requesting-provider ───────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'requesting-provider');

    const result = await generateStructuredObject({
      model: modelId,
      system: systemPrompt,
      prompt: userPrompt,
      schema: generateDraftOutputSchema,
      operation: 'draft-async',
      metadata: { category: requestPayload.category, runId },
      providerRouting: draftRouting,
      timeoutMs: env.AI_POSTS_TIMEOUT_MS,
      maxRetries: ASYNC_AI_GENERATION_MAX_RETRIES,
    });
    providerGenerationId = result.providerGenerationId;

    // ── Stage: normalizing-output ────────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'normalizing-output', 'validating');

    const persistedTags = await loadPersistedTagsForNormalization();

    // ── Stage: canonicalizing-tags ───────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'canonicalizing-tags', 'validating');

    // ── Stage: validating-output ─────────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'validating-output', 'validating');

    const parsed = normalizeDraftResponse(result.object, persistedTags);

    // ── Stage: persisting-result ─────────────────────────────────────────────
    await setAiRunStage(aiPostDraftRuns, runId, 'persisting-result', 'validating');

    const finishedAt = new Date();
    await db
      .update(aiPostDraftRuns)
      .set({
        status: 'completed',
        stage: 'completed',
        resultPayload: parsed as unknown as Record<string, unknown>,
        providerGenerationId,
        finishedAt,
        updatedAt: finishedAt,
        lastHeartbeatAt: finishedAt,
      })
      .where(eq(aiPostDraftRuns.id, runId));

    logger.info('AI draft generation job completed', {
      ...jobMeta,
      requestedCategory,
      selectedSuggestionCategory,
      attemptCount,
      providerGenerationId,
      durationMs: result.durationMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    const finishedAt = new Date();
    const failure = resolveAiJobFailure(job, err);
    const { errorCode, errorKind, errorMessage, shouldRetry, stage, status } = failure;

    if (shouldRetry) {
      await db
        .update(aiPostDraftRuns)
        .set({
          status: 'queued',
          stage: 'queued',
          finishedAt: null,
          updatedAt: finishedAt,
          lastHeartbeatAt: finishedAt,
          errorKind: null,
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(aiPostDraftRuns.id, runId))
        .catch((dbErr) => {
          logger.error('AI draft job: failed to persist retry state', {
            ...jobMeta,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        });

      logger.warn('AI draft generation job scheduled for retry', {
        ...jobMeta,
        requestedCategory,
        selectedSuggestionCategory,
        attempt: (job.attemptsMade ?? 0) + 1,
        maxAttempts: job.opts?.attempts ?? 1,
        providerGenerationId,
        error: errorMessage,
      });

      throw err;
    }

    await db
      .update(aiPostDraftRuns)
      .set({
        status,
        stage,
        finishedAt,
        updatedAt: finishedAt,
        lastHeartbeatAt: finishedAt,
        providerGenerationId,
        errorKind,
        errorCode,
        errorMessage,
      })
      .where(eq(aiPostDraftRuns.id, runId))
      .catch((dbErr) => {
        logger.error('AI draft job: failed to persist error state', {
          ...jobMeta,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      });

    logger.error('AI draft generation job failed', {
      ...jobMeta,
      requestedCategory,
      selectedSuggestionCategory,
      attemptCount,
      providerGenerationId,
      errorKind,
      errorCode,
      error: errorMessage,
    });

    // Terminal state persisted — prevent BullMQ from retrying.
    // Only transient provider failures (handled by shouldRetryProviderFailure above)
    // are allowed to retry via a normal re-throw.
    throw new UnrecoverableError(errorMessage);
  }
}
