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
} from '@portfolio/shared';
import { aiPostDraftRuns } from '@portfolio/shared/db/schema';
import type { Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { generateStructuredObject } from '../lib/ai/generateStructuredObject';

const logger = getLogger('worker', 'jobs', 'ai-post-draft-generation');

async function setStage(runId: string, stage: AiPostDraftRunStage): Promise<void> {
  await db
    .update(aiPostDraftRuns)
    .set({ stage, lastHeartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(aiPostDraftRuns.id, runId));
}

export interface AiPostDraftJobData {
  runId: string;
}

export async function processAiPostDraftGeneration(job: Job<AiPostDraftJobData>): Promise<void> {
  const { runId } = job.data;
  const jobMeta = { jobId: job.id, runId };

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
      attemptCount: (job.attemptsMade ?? 0) + 1,
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
        errorKind: 'provider',
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

    // ── Stage: normalizing-output ────────────────────────────────────────────
    await setStage(runId, 'normalizing-output');

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

    // ── Stage: canonicalizing-tags ───────────────────────────────────────────
    await setStage(runId, 'canonicalizing-tags');

    const suggestedTagNames = canonicalizeSuggestedTagNames(raw.suggestedTagNames).slice(0, 8);

    // ── Stage: validating-output ─────────────────────────────────────────────
    await setStage(runId, 'validating-output');

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
    await setStage(runId, 'persisting-result');

    const finishedAt = new Date();
    await db
      .update(aiPostDraftRuns)
      .set({
        status: 'completed',
        stage: 'completed',
        resultPayload: parsed.data as unknown as Record<string, unknown>,
        finishedAt,
        updatedAt: finishedAt,
        lastHeartbeatAt: finishedAt,
      })
      .where(eq(aiPostDraftRuns.id, runId));

    logger.info('AI draft generation job completed', {
      ...jobMeta,
      durationMs: result.durationMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    const finishedAt = new Date();
    const aiErr = err instanceof AiGenerationError ? err : null;

    const errorKind = aiErr?.kind ?? 'provider';
    const errorCode = aiErr ? null : ((err as Error & { code?: string })?.code ?? null);
    const errorMessage = err instanceof Error ? err.message : String(err);

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
      errorKind,
      errorCode,
      error: errorMessage,
    });

    // Re-throw so BullMQ can handle retries
    throw err;
  }
}
