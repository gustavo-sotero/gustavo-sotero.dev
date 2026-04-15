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

import {
  AiGenerationError,
  type AiPostDraftRunStage,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildFallbackImagePrompt,
  canonicalizeSuggestedTagNames,
  containsDisallowedInlineHtml,
  generateDraftOutputSchema,
  generateDraftResponseSchema,
  generateSlug,
  normalizeContent,
  type PersistedTagForNormalization,
} from '@portfolio/shared';
import { aiPostDraftRuns, tags } from '@portfolio/shared/db/schema';
import type { Job } from 'bullmq';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { generateStructuredObject } from '../lib/ai/generateStructuredObject';

const logger = getLogger('worker', 'jobs', 'ai-post-draft-generation');

type ActiveRunStatus = 'running' | 'validating';

async function setStage(
  runId: string,
  stage: AiPostDraftRunStage,
  status?: ActiveRunStatus
): Promise<void> {
  const update: Partial<typeof aiPostDraftRuns.$inferInsert> = {
    stage,
    lastHeartbeatAt: new Date(),
    updatedAt: new Date(),
  };

  if (status) {
    update.status = status;
  }

  await db.update(aiPostDraftRuns).set(update).where(eq(aiPostDraftRuns.id, runId));
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

function shouldRetryProviderFailure(job: Job<AiPostDraftJobData>, errorKind: string): boolean {
  const configuredAttempts = job.opts?.attempts ?? 1;
  return errorKind === 'provider' && (job.attemptsMade ?? 0) + 1 < configuredAttempts;
}

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
  const now = new Date();
  const [claimed] = await db
    .update(aiPostDraftRuns)
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
        eq(aiPostDraftRuns.id, runId),
        // Only claim if still queued to prevent double-processing on retry
        eq(aiPostDraftRuns.status, 'queued')
      )
    )
    .returning();

  if (!claimed) {
    // Run was already claimed (concurrent relay delivery or manual intervention)
    logger.warn('AI draft job: run already claimed or not in queued status', jobMeta);
    return;
  }

  const modelId = claimed.modelId;
  if (!modelId) {
    await db
      .update(aiPostDraftRuns)
      .set({
        status: 'failed',
        stage: 'failed',
        finishedAt: new Date(),
        updatedAt: new Date(),
        errorKind: 'config',
        errorCode: 'NO_MODEL_ID',
        errorMessage: 'Run created without a resolved model ID.',
      })
      .where(eq(aiPostDraftRuns.id, runId));
    logger.error('AI draft job: run has no modelId', jobMeta);
    return;
  }

  const requestPayload = claimed.requestPayload as {
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
  const requestedCategory = requestPayload.category;
  const selectedSuggestionCategory = requestPayload.selectedSuggestion.category;
  let providerGenerationId: string | null = null;

  try {
    // ── Stage: building-prompt ───────────────────────────────────────────────
    await setStage(runId, 'building-prompt');

    const systemPrompt = buildDraftSystemPrompt(requestPayload.category);
    const userPrompt = buildDraftUserPrompt(
      requestPayload as Parameters<typeof buildDraftUserPrompt>[0]
    );

    // ── Stage: requesting-provider ───────────────────────────────────────────
    await setStage(runId, 'requesting-provider');

    const result = await generateStructuredObject({
      model: modelId,
      system: systemPrompt,
      prompt: userPrompt,
      schema: generateDraftOutputSchema,
      operation: 'draft-async',
      metadata: { category: requestPayload.category, runId },
    });
    providerGenerationId = result.providerGenerationId;

    // ── Stage: normalizing-output ────────────────────────────────────────────
    await setStage(runId, 'normalizing-output', 'validating');

    const raw = result.object;
    const title = raw.title.trim();
    const slug = generateSlug(raw.slug.trim() || title);
    const excerpt = raw.excerpt.trim();
    const content = normalizeContent(raw.content);

    if (containsDisallowedInlineHtml(content)) {
      throw new AiGenerationError(
        'validation',
        'Generated draft contained inline HTML instead of clean Markdown'
      );
    }

    const imagePrompt = raw.imagePrompt.trim() || buildFallbackImagePrompt(title);
    const notes = raw.notes?.trim() ?? null;
    const persistedTags = await loadPersistedTagsForNormalization();

    // ── Stage: canonicalizing-tags ───────────────────────────────────────────
    await setStage(runId, 'canonicalizing-tags', 'validating');

    const suggestedTagNames = canonicalizeSuggestedTagNames(
      raw.suggestedTagNames,
      persistedTags
    ).slice(0, 8);

    // ── Stage: validating-output ─────────────────────────────────────────────
    await setStage(runId, 'validating-output', 'validating');

    const parsed = generateDraftResponseSchema.safeParse({
      title,
      slug,
      excerpt,
      content,
      suggestedTagNames,
      imagePrompt,
      notes,
    });

    if (!parsed.success) {
      throw new AiGenerationError(
        'validation',
        'Generated draft is too short or missing required fields'
      );
    }

    // ── Stage: persisting-result ─────────────────────────────────────────────
    await setStage(runId, 'persisting-result', 'validating');

    const finishedAt = new Date();
    await db
      .update(aiPostDraftRuns)
      .set({
        status: 'completed',
        stage: 'completed',
        resultPayload: parsed.data as unknown as Record<string, unknown>,
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
    const aiErr = err instanceof AiGenerationError ? err : null;

    const errorKind = aiErr?.kind ?? classifyJobError(err);
    const errorCode = aiErr ? null : ((err as Error & { code?: string })?.code ?? null);
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (shouldRetryProviderFailure(job, errorKind)) {
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

    const status = errorKind === 'timeout' ? ('timed_out' as const) : ('failed' as const);
    const stage = errorKind === 'timeout' ? ('timed-out' as const) : ('failed' as const);

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

    // Re-throw so BullMQ can handle retries
    throw err;
  }
}
