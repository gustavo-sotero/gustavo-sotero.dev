/**
 * AI Post Topic Generation Job
 *
 * Processes async AI topic generation runs created via POST /admin/posts/generate/topic-runs.
 *
 * Flow:
 *  1. Load run record (guard: must be in 'queued' status)
 *  2. Claim run atomically (queued → running)
 *  3. Progress through stages with heartbeat updates
 *  4. Generate topic suggestions via OpenRouter AI provider
 *  5. Normalize and canonicalize output
 *  6. Persist result (running → completed) or error (→ failed/timed_out)
 */

import { aiPostTopicRuns } from '@portfolio/shared/db/schema';
import { executeTopicsGeneration } from '@portfolio/shared/lib/ai-post-generation-execution';
import type { GenerateTopicsRequest } from '@portfolio/shared/schemas/ai-post-generation';
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

const logger = getLogger('worker', 'jobs', 'ai-post-topic-generation');
const ASYNC_AI_GENERATION_MAX_RETRIES = 0;

export interface AiPostTopicJobData {
  runId: string;
}

export async function processAiPostTopicGeneration(job: Job<AiPostTopicJobData>): Promise<void> {
  const { runId } = job.data;
  const jobMeta = { jobId: job.id, runId };
  const attemptCount = (job.attemptsMade ?? 0) + 1;

  logger.info('AI topic generation job started', jobMeta);

  // ── Stage: resolving-config ────────────────────────────────────────────────
  // Load the run record and claim it atomically (queued → running).
  const claimed = await claimQueuedAiRun<{
    modelId: string | null;
    requestPayload: GenerateTopicsRequest;
  }>(aiPostTopicRuns, runId, attemptCount);

  if (!claimed) {
    // Run was already claimed (concurrent relay delivery or manual intervention)
    logger.warn('AI topic job: run already claimed or not in queued status', jobMeta);
    return;
  }

  const modelId = claimed.modelId;
  if (!modelId) {
    await markAiRunMissingModelId(aiPostTopicRuns, runId);
    logger.error('AI topic job: run has no modelId', jobMeta);
    return;
  }

  const requestPayload = claimed.requestPayload as GenerateTopicsRequest;
  const requestedCategory = requestPayload.category;
  let providerGenerationId: string | null = null;

  const topicsRouting = await loadAiProviderRoutingConfig('topics');

  try {
    const { response: parsed, result } = await executeTopicsGeneration({
      model: modelId,
      request: requestPayload,
      operation: 'topic-async',
      metadata: { category: requestPayload.category, runId },
      providerRouting: topicsRouting,
      timeoutMs: env.AI_POSTS_TIMEOUT_MS,
      maxRetries: ASYNC_AI_GENERATION_MAX_RETRIES,
      generateStructuredObject,
      loadPersistedTags: loadPersistedTagsForNormalization,
      lifecycle: {
        onBuildingPrompt: () => setAiRunStage(aiPostTopicRuns, runId, 'building-prompt'),
        onRequestingProvider: () => setAiRunStage(aiPostTopicRuns, runId, 'requesting-provider'),
        onNormalizingOutput: () =>
          setAiRunStage(aiPostTopicRuns, runId, 'normalizing-output', 'validating'),
        onCanonicalizingTags: () =>
          setAiRunStage(aiPostTopicRuns, runId, 'canonicalizing-tags', 'validating'),
        onValidatingOutput: () =>
          setAiRunStage(aiPostTopicRuns, runId, 'validating-output', 'validating'),
      },
    });
    providerGenerationId = result.providerGenerationId;

    // ── Stage: persisting-result ─────────────────────────────────────────────
    await setAiRunStage(aiPostTopicRuns, runId, 'persisting-result', 'validating');

    const finishedAt = new Date();
    await db
      .update(aiPostTopicRuns)
      .set({
        status: 'completed',
        stage: 'completed',
        resultPayload: parsed as unknown as Record<string, unknown>,
        providerGenerationId,
        finishedAt,
        updatedAt: finishedAt,
        lastHeartbeatAt: finishedAt,
      })
      .where(eq(aiPostTopicRuns.id, runId));

    logger.info('AI topic generation job completed', {
      ...jobMeta,
      requestedCategory,
      attemptCount,
      providerGenerationId,
      suggestionCount: parsed.suggestions.length,
      durationMs: result.durationMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    providerGenerationId =
      (err as Error & { providerGenerationId?: string | null }).providerGenerationId ??
      providerGenerationId;
    const finishedAt = new Date();
    const failure = resolveAiJobFailure(job, err);
    const { errorCode, errorKind, errorMessage, shouldRetry, stage, status } = failure;

    if (shouldRetry) {
      await db
        .update(aiPostTopicRuns)
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
        .where(eq(aiPostTopicRuns.id, runId))
        .catch((dbErr) => {
          logger.error('AI topic job: failed to persist retry state', {
            ...jobMeta,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        });

      logger.warn('AI topic generation job scheduled for retry', {
        ...jobMeta,
        requestedCategory,
        attempt: (job.attemptsMade ?? 0) + 1,
        maxAttempts: job.opts?.attempts ?? 1,
        providerGenerationId,
        error: errorMessage,
      });

      throw err;
    }

    await db
      .update(aiPostTopicRuns)
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
      .where(eq(aiPostTopicRuns.id, runId))
      .catch((dbErr) => {
        logger.error('AI topic job: failed to persist error state', {
          ...jobMeta,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      });

    logger.error('AI topic generation job failed', {
      ...jobMeta,
      requestedCategory,
      attemptCount,
      providerGenerationId,
      errorKind,
      errorCode,
      error: errorMessage,
    });

    // Only retry transient provider failures while attempts remain.
    // Once a terminal run state is persisted, stop BullMQ retries explicitly.
    throw new UnrecoverableError(errorMessage);
  }
}
