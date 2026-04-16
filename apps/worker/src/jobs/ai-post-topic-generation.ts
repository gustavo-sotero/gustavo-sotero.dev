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

import {
  AiGenerationError,
  type AiPostTopicRunStage,
  buildTopicsSystemPrompt,
  buildTopicsUserPrompt,
  canonicalizeSuggestedTagNames,
  type GenerateTopicsRequest,
  generateSlug,
  generateTopicsOutputSchema,
  generateTopicsResponseSchema,
  type PersistedTagForNormalization,
  type ProviderRoutingConfig,
  providerRoutingConfigSchema,
  type TopicSuggestion,
} from '@portfolio/shared';
import { aiPostTopicRuns, tags } from '@portfolio/shared/db/schema';
import type { Job } from 'bullmq';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { generateStructuredObject } from '../lib/ai/generateStructuredObject';

const logger = getLogger('worker', 'jobs', 'ai-post-topic-generation');
const ASYNC_AI_GENERATION_MAX_RETRIES = 0;

type ActiveRunStatus = 'running' | 'validating';

async function setStage(
  runId: string,
  stage: AiPostTopicRunStage,
  status?: ActiveRunStatus
): Promise<void> {
  const update: Partial<typeof aiPostTopicRuns.$inferInsert> = {
    stage,
    lastHeartbeatAt: new Date(),
    updatedAt: new Date(),
  };

  if (status) {
    update.status = status;
  }

  await db.update(aiPostTopicRuns).set(update).where(eq(aiPostTopicRuns.id, runId));
}

async function loadPersistedTagsForNormalization(): Promise<PersistedTagForNormalization[]> {
  return db.select({ name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name));
}

function classifyJobError(error: unknown): 'config' | 'internal' {
  const message = error instanceof Error ? error.message : String(error);
  if (/OPENROUTER_API_KEY|model ID|modelId/i.test(message)) {
    return 'config';
  }

  return 'internal';
}

function shouldRetryProviderFailure(job: Job<AiPostTopicJobData>, errorKind: string): boolean {
  const configuredAttempts = job.opts?.attempts ?? 1;
  return errorKind === 'provider' && (job.attemptsMade ?? 0) + 1 < configuredAttempts;
}

function deduplicateSuggestions(suggestions: TopicSuggestion[]): TopicSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = generateSlug(s.proposedTitle);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSuggestion(
  s: TopicSuggestion,
  persistedTags: PersistedTagForNormalization[]
): TopicSuggestion {
  const AI_POST_MAX_TOPIC_TAG_NAMES = 6;
  return {
    ...s,
    suggestionId: s.suggestionId.trim() || crypto.randomUUID().slice(0, 8),
    proposedTitle: s.proposedTitle.trim(),
    angle: s.angle.trim(),
    summary: s.summary.trim(),
    targetReader: s.targetReader.trim(),
    rationale: s.rationale.trim(),
    suggestedTagNames: canonicalizeSuggestedTagNames(s.suggestedTagNames, persistedTags).slice(
      0,
      AI_POST_MAX_TOPIC_TAG_NAMES
    ),
  };
}

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
  const now = new Date();
  const [claimed] = await db
    .update(aiPostTopicRuns)
    .set({
      status: 'running',
      stage: 'resolving-config',
      startedAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
      attemptCount,
      errorKind: null,
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(aiPostTopicRuns.id, runId),
        // Only claim if still queued to prevent double-processing on retry
        eq(aiPostTopicRuns.status, 'queued')
      )
    )
    .returning();

  if (!claimed) {
    // Run was already claimed (concurrent relay delivery or manual intervention)
    logger.warn('AI topic job: run already claimed or not in queued status', jobMeta);
    return;
  }

  const modelId = claimed.modelId;
  if (!modelId) {
    await db
      .update(aiPostTopicRuns)
      .set({
        status: 'failed',
        stage: 'failed',
        finishedAt: new Date(),
        updatedAt: new Date(),
        errorKind: 'config',
        errorCode: 'NO_MODEL_ID',
        errorMessage: 'Run created without a resolved model ID.',
      })
      .where(eq(aiPostTopicRuns.id, runId));
    logger.error('AI topic job: run has no modelId', jobMeta);
    return;
  }

  const requestPayload = claimed.requestPayload as GenerateTopicsRequest;
  const requestedCategory = requestPayload.category;
  const limit = requestPayload.limit ?? 4;
  let providerGenerationId: string | null = null;

  // Read routing config from settings (best-effort; proceeds without routing on failure)
  let topicsRouting: ProviderRoutingConfig | undefined;
  try {
    const settings = await db.query.aiPostGenerationSettings.findFirst();
    const parsedRouting = providerRoutingConfigSchema.safeParse(settings?.topicsRouting ?? null);
    topicsRouting = parsedRouting.success ? (parsedRouting.data ?? undefined) : undefined;
  } catch {
    // Non-fatal: routing config unavailable, proceed without it
  }

  try {
    // ── Stage: building-prompt ───────────────────────────────────────────────
    await setStage(runId, 'building-prompt');

    const systemPrompt = buildTopicsSystemPrompt(requestPayload.category);
    const userPrompt = buildTopicsUserPrompt(requestPayload);

    // ── Stage: requesting-provider ───────────────────────────────────────────
    await setStage(runId, 'requesting-provider');

    const result = await generateStructuredObject({
      model: modelId,
      system: systemPrompt,
      prompt: userPrompt,
      schema: generateTopicsOutputSchema,
      operation: 'topic-async',
      metadata: { category: requestPayload.category, runId },
      providerRouting: topicsRouting,
      timeoutMs: env.AI_POSTS_TIMEOUT_MS,
      maxRetries: ASYNC_AI_GENERATION_MAX_RETRIES,
    });
    providerGenerationId = result.providerGenerationId;

    // ── Stage: normalizing-output ────────────────────────────────────────────
    await setStage(runId, 'normalizing-output', 'validating');

    const raw = result.object as { suggestions: TopicSuggestion[] };
    const persistedTags = await loadPersistedTagsForNormalization();

    // ── Stage: canonicalizing-tags ───────────────────────────────────────────
    await setStage(runId, 'canonicalizing-tags', 'validating');

    const normalized = deduplicateSuggestions(
      raw.suggestions.map((s) => normalizeSuggestion(s, persistedTags))
    );

    // ── Stage: validating-output ─────────────────────────────────────────────
    await setStage(runId, 'validating-output', 'validating');

    const parsed = generateTopicsResponseSchema.safeParse({
      suggestions: normalized.slice(0, limit),
    });

    if (!parsed.success) {
      throw new AiGenerationError(
        'validation',
        'Generated topics did not satisfy the response contract'
      );
    }

    // ── Stage: persisting-result ─────────────────────────────────────────────
    await setStage(runId, 'persisting-result', 'validating');

    const finishedAt = new Date();
    await db
      .update(aiPostTopicRuns)
      .set({
        status: 'completed',
        stage: 'completed',
        resultPayload: parsed.data as unknown as Record<string, unknown>,
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
      suggestionCount: parsed.data.suggestions.length,
      durationMs: result.durationMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    const finishedAt = new Date();
    const aiErr = err instanceof AiGenerationError ? err : null;

    const errorKind = aiErr?.kind ?? classifyJobError(err);
    const errorCode = aiErr ? null : ((err as Error & { code?: string })?.code ?? null);
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (shouldRetryProviderFailure(job, errorKind)) {
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

    const status = errorKind === 'timeout' ? ('timed_out' as const) : ('failed' as const);
    const stage = errorKind === 'timeout' ? ('timed-out' as const) : ('failed' as const);

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

    // Re-throw so BullMQ can handle retries
    throw err;
  }
}
