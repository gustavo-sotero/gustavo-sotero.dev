/**
 * Transactional Outbox Relay
 *
 * Polls the `outbox` table for pending events and publishes them to BullMQ.
 * Deterministic BullMQ job IDs (from `@portfolio/shared/lib/jobIds`) provide
 * idempotency — if the relay runs twice before marking a row as processed,
 * BullMQ silently deduplicates the second publish attempt.
 *
 * NOTE: BullMQ v5+ rejects any custom jobId containing `:`. All job IDs are
 * built via the shared helpers which use hyphens instead.
 *
 * Failure classes:
 *  UNSUPPORTED_EVENT_TYPE     — event.eventType is not a known OutboxEventType value
 *  INVALID_PAYLOAD            — event.payload does not pass the event-type schema
 *  QUEUE_PUBLISH_FAILURE      — queue.add() threw; the job was never enqueued
 *  OUTBOX_STATUS_UPDATE_FAILURE — queue.add() succeeded but marking the outbox row
 *                                 as processed failed (job will still run due to dedup)
 */

import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { getOutboxQueueTarget } from '@portfolio/shared/constants/queues';
import { outbox, uploads } from '@portfolio/shared/db/schema';
import {
  aiPostDraftRunJobId,
  aiPostTopicRunJobId,
  imageOptimizeJobId,
  scheduledPostPublishJobId,
} from '@portfolio/shared/lib/jobIds';
import {
  aiPostDraftGenerateRequestedOutboxPayloadSchema,
  aiPostTopicRunRequestedOutboxPayloadSchema,
  imageOptimizeOutboxPayloadSchema,
  scheduledPostPublishOutboxPayloadSchema,
} from '@portfolio/shared/schemas/outbox';
import type { Job, Queue } from 'bullmq';
import { and, asc, count, eq, lte, min } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('lib', 'outbox-relay');
let outboxSchemaMissing = false;

type RelayProcessedByEventType = Partial<
  Record<(typeof OutboxEventType)[keyof typeof OutboxEventType], number>
>;

/** Structured failure category for relay log correlation. */
type RelayFailureClass =
  | 'UNSUPPORTED_EVENT_TYPE'
  | 'INVALID_PAYLOAD'
  | 'QUEUE_PUBLISH_FAILURE'
  | 'OUTBOX_STATUS_UPDATE_FAILURE';

export const OUTBOX_MAX_ATTEMPTS = 5;

function incrementCounter<T extends string>(counter: Partial<Record<T, number>>, key: T): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Upserts a scheduled-post-publish job in BullMQ with full state-aware reschedule semantics.
 *
 * A deterministic `jobId = post-publish-{postId}` makes this function idempotent for
 * outbox replays, and also enables the correct reschedule path when `scheduledAt` changes:
 *
 *  - Job **missing**:  create fresh delayed job.
 *  - Job **delayed**:  call `changeDelay()` — the only BullMQ-native reschedule path.
 *  - Job **active**:   leave in place; the processor will re-delay itself after reading
 *                      the DB-authoritative `scheduledAt`.
 *  - Job **waiting** / **prioritized** / **paused** / **completed** / **failed** / **unknown**:
 *                      remove and re-add so the correct delay is applied.
 */
async function upsertScheduledPostPublishJob(
  postPublishQueue: Queue,
  opts: { postId: number; scheduledAt: string; eventId: string }
): Promise<void> {
  const { postId, scheduledAt, eventId } = opts;
  const target = getOutboxQueueTarget(OutboxEventType.SCHEDULED_POST_PUBLISH);
  const jobId = scheduledPostPublishJobId(postId);
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
  const jobOptions = {
    jobId,
    delay,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  };

  const existing = await postPublishQueue.getJob(jobId);

  if (!existing) {
    await postPublishQueue.add(target.jobName, { postId }, jobOptions);
    logger.info('Outbox relay: scheduled-post-publish job created', {
      eventId,
      postId,
      jobId,
      scheduledAt,
      delay,
      action: 'created',
    });
    return;
  }

  const existingState = await (existing as Job).getState();

  if (existingState === 'delayed') {
    // changeDelay is the BullMQ-native API for rescheduling a delayed job.
    // Using queue.add() with the same jobId here would be silently deduped
    // and the old delay would remain — that is the root cause of the reschedule bug.
    await (existing as Job).changeDelay(delay);
    logger.info('Outbox relay: scheduled-post-publish job rescheduled', {
      eventId,
      postId,
      jobId,
      scheduledAt,
      delay,
      existingState,
      action: 'rescheduled',
    });
    return;
  }

  if (existingState === 'active') {
    // Active jobs hold a lock and cannot be removed safely.
    // The processor will consult the DB-authoritative scheduledAt and call
    // job.moveToDelayed() + throw DelayedError if the deadline has not arrived.
    logger.info('Outbox relay: scheduled-post-publish job is active; processor will self-delay', {
      eventId,
      postId,
      jobId,
      scheduledAt,
      existingState,
      action: 'active-job-kept',
    });
    return;
  }

  // For all other states (waiting, prioritized, paused, completed, failed, unknown):
  // remove and re-add to restore the correct delay.
  try {
    await (existing as Job).remove();
  } catch (removeErr) {
    logger.warn('Outbox relay: could not remove existing job before re-add', {
      eventId,
      postId,
      jobId,
      existingState,
      error: removeErr instanceof Error ? removeErr.message : String(removeErr),
    });
  }

  await postPublishQueue.add(target.jobName, { postId }, jobOptions);
  logger.info('Outbox relay: scheduled-post-publish job replaced', {
    eventId,
    postId,
    jobId,
    scheduledAt,
    delay,
    existingState,
    action: 'replaced',
  });
}

function isMissingOutboxSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; message?: string };

  if (candidate.code === '42P01' || candidate.code === '42704') {
    return true;
  }

  return /(?:relation|table|type)\s+['"]?(?:public\.)?(?:outbox|outbox_status)['"]?\s+does not exist/i.test(
    candidate.message ?? ''
  );
}

export function resetOutboxRelayStateForTests(): void {
  outboxSchemaMissing = false;
}

export async function processOutboxEvents(
  imageQueue: Queue,
  postPublishQueue: Queue,
  aiPostDraftGenerationQueue: Queue,
  aiPostTopicGenerationQueue: Queue,
  options?: { batchSize?: number }
): Promise<void> {
  const batchSize = options?.batchSize ?? 20;
  const cycleStartAt = Date.now();
  let events: (typeof outbox.$inferSelect)[];

  // ── Backlog measurement ─────────────────────────────────────────────────────
  let backlogSize = 0;
  let oldestPendingAgeMs: number | undefined;
  try {
    const [metrics] = await db
      .select({ backlog: count(), oldest: min(outbox.createdAt) })
      .from(outbox)
      .where(and(eq(outbox.status, 'pending'), lte(outbox.attempts, OUTBOX_MAX_ATTEMPTS - 1)));
    backlogSize = metrics?.backlog ?? 0;
    if (metrics?.oldest) {
      oldestPendingAgeMs = cycleStartAt - new Date(metrics.oldest).getTime();
    }
  } catch {
    // Non-fatal: instrumentation must not interrupt relay processing
  }
  // ── End of backlog measurement ──────────────────────────────────────────────

  try {
    events = await db
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, 'pending'), lte(outbox.attempts, OUTBOX_MAX_ATTEMPTS - 1)))
      .orderBy(asc(outbox.createdAt))
      .limit(batchSize);
  } catch (err) {
    if (isMissingOutboxSchemaError(err)) {
      if (!outboxSchemaMissing) {
        outboxSchemaMissing = true;
        logger.warn('Outbox relay: outbox schema unavailable; waiting for migrations to complete', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return;
    }

    logger.error('Outbox relay: failed to query pending events', {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (outboxSchemaMissing) {
    outboxSchemaMissing = false;
    logger.info('Outbox relay: outbox schema detected; resuming relay processing');
  }

  let processedCount = 0;
  let failedCount = 0;
  const processedByEventType: RelayProcessedByEventType = {};
  const failedByClass: Partial<Record<RelayFailureClass, number>> = {};

  for (const event of events) {
    // Extract uploadId eagerly from the raw payload for reconciliation purposes.
    // This is intentionally done before schema validation so that even a
    // malformed image-optimize event can still have its upload row reconciled
    // if the uploadId field is present but the schema otherwise rejects the payload.
    let resolvedUploadId: string | undefined;
    if (event.eventType === OutboxEventType.IMAGE_OPTIMIZE) {
      const raw = event.payload as Record<string, unknown> | null;
      if (raw && typeof raw.uploadId === 'string') {
        resolvedUploadId = raw.uploadId;
      }
    }

    let queuePublishSucceeded = false;

    try {
      if (event.eventType === OutboxEventType.IMAGE_OPTIMIZE) {
        const target = getOutboxQueueTarget(OutboxEventType.IMAGE_OPTIMIZE);
        const payloadResult = imageOptimizeOutboxPayloadSchema.safeParse(event.payload);

        if (!payloadResult.success) {
          throw Object.assign(
            new Error(`Invalid image-optimize payload: ${payloadResult.error.message}`),
            { failureClass: 'INVALID_PAYLOAD' as RelayFailureClass }
          );
        }

        const { uploadId } = payloadResult.data;

        // Deterministic jobId via shared helper — BullMQ deduplicates replays automatically.
        // The helper uses `outbox-{uuid}` (hyphen separator) which is required because
        // BullMQ v5+ rejects any custom jobId containing `:`.
        await imageQueue.add(
          target.jobName,
          { uploadId },
          {
            jobId: imageOptimizeJobId(event.id),
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          }
        );
      } else if (event.eventType === OutboxEventType.SCHEDULED_POST_PUBLISH) {
        const payloadResult = scheduledPostPublishOutboxPayloadSchema.safeParse(event.payload);

        if (!payloadResult.success) {
          throw Object.assign(
            new Error(`Invalid scheduled-post-publish payload: ${payloadResult.error.message}`),
            { failureClass: 'INVALID_PAYLOAD' as RelayFailureClass }
          );
        }

        const { postId, scheduledAt } = payloadResult.data;

        await upsertScheduledPostPublishJob(postPublishQueue, {
          postId,
          scheduledAt,
          eventId: event.id,
        });
      } else if (event.eventType === OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED) {
        const target = getOutboxQueueTarget(OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED);
        const payloadResult = aiPostDraftGenerateRequestedOutboxPayloadSchema.safeParse(
          event.payload
        );

        if (!payloadResult.success) {
          throw Object.assign(
            new Error(
              `Invalid ai-post-draft-generate-requested payload: ${payloadResult.error.message}`
            ),
            { failureClass: 'INVALID_PAYLOAD' as RelayFailureClass }
          );
        }

        const { runId } = payloadResult.data;

        await aiPostDraftGenerationQueue.add(
          target.jobName,
          { runId },
          {
            jobId: aiPostDraftRunJobId(runId),
            attempts: 2,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );
      } else if (event.eventType === OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED) {
        const payloadResult = aiPostTopicRunRequestedOutboxPayloadSchema.safeParse(event.payload);

        if (!payloadResult.success) {
          throw Object.assign(
            new Error(
              `Invalid ai-post-topic-run-requested payload: ${payloadResult.error.message}`
            ),
            { failureClass: 'INVALID_PAYLOAD' as RelayFailureClass }
          );
        }

        const { runId } = payloadResult.data;

        await aiPostTopicGenerationQueue.add(
          getOutboxQueueTarget(OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED).jobName,
          { runId },
          {
            jobId: aiPostTopicRunJobId(runId),
            attempts: 2,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );
      } else {
        // Unknown event type — throw so the event enters the retry/failure path
        // rather than being silently consumed. This surfaces domain contract drift.
        throw Object.assign(new Error(`Unsupported outbox event type: "${event.eventType}"`), {
          failureClass: 'UNSUPPORTED_EVENT_TYPE' as RelayFailureClass,
        });
      }

      // queue.add() succeeded — mark separately so the catch block can classify
      // a subsequent outbox-status write failure correctly.
      queuePublishSucceeded = true;

      await db
        .update(outbox)
        .set({ status: 'processed', processedAt: new Date(), lastAttemptAt: new Date() })
        .where(eq(outbox.id, event.id));

      logger.debug('Outbox relay: event published', {
        eventId: event.id,
        eventType: event.eventType,
      });
      processedCount++;
      incrementCounter(
        processedByEventType,
        event.eventType as (typeof OutboxEventType)[keyof typeof OutboxEventType]
      );
    } catch (err) {
      const newAttempts = event.attempts + 1;
      const isFinal = newAttempts >= OUTBOX_MAX_ATTEMPTS;
      const errObj = err as Error & { failureClass?: RelayFailureClass };

      // When the queue publish succeeded but the outbox status-update failed, the
      // job will still run (BullMQ dedup prevents duplicate work). Log this case
      // distinctly: no upload reconciliation needed since the job is live.
      const failureClass: RelayFailureClass =
        errObj.failureClass === 'INVALID_PAYLOAD'
          ? 'INVALID_PAYLOAD'
          : errObj.failureClass === 'UNSUPPORTED_EVENT_TYPE'
            ? 'UNSUPPORTED_EVENT_TYPE'
            : queuePublishSucceeded
              ? 'OUTBOX_STATUS_UPDATE_FAILURE'
              : 'QUEUE_PUBLISH_FAILURE';

      await db
        .update(outbox)
        .set({
          attempts: newAttempts,
          lastAttemptAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
          ...(isFinal ? { status: 'failed' as const } : {}),
        })
        .where(eq(outbox.id, event.id))
        .catch((dbErr) => {
          logger.error('Outbox relay: failed to persist attempt result', {
            eventId: event.id,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        });

      // Reconcile: when the final relay attempt fails for an image-optimize event
      // and the queue publish never succeeded, the imageOptimize job will never run.
      // Mark the upload as failed so the admin UI shows a terminal error state
      // instead of stalling indefinitely in the `uploaded` pseudo-processing limbo.
      //
      // Do NOT reconcile when queuePublishSucceeded=true (OUTBOX_STATUS_UPDATE_FAILURE):
      // the job is already in BullMQ and imageOptimize.ts manages the terminal states.
      if (
        isFinal &&
        !queuePublishSucceeded &&
        event.eventType === OutboxEventType.IMAGE_OPTIMIZE &&
        resolvedUploadId
      ) {
        await db
          .update(uploads)
          .set({ status: 'failed' })
          .where(eq(uploads.id, resolvedUploadId))
          .catch((dbErr) => {
            logger.error(
              'Outbox relay: failed to reconcile upload status after terminal relay failure',
              {
                eventId: event.id,
                uploadId: resolvedUploadId,
                error: dbErr instanceof Error ? dbErr.message : String(dbErr),
              }
            );
          });

        logger.warn('Outbox relay: upload marked as failed after terminal relay failure', {
          eventId: event.id,
          uploadId: resolvedUploadId,
        });
      }

      logger.error('Outbox relay: failed to process event', {
        eventId: event.id,
        eventType: event.eventType,
        attempt: newAttempts,
        isFinal,
        failureClass,
        ...(resolvedUploadId ? { uploadId: resolvedUploadId } : {}),
        error: err instanceof Error ? err.message : String(err),
      });
      failedCount++;
      incrementCounter(failedByClass, failureClass);
    }
  }

  // ── Cycle summary ───────────────────────────────────────────────────────────
  if (events.length > 0 || backlogSize > 0) {
    logger.info('Outbox relay: cycle complete', {
      backlogSize,
      ...(oldestPendingAgeMs !== undefined ? { oldestPendingAgeMs } : {}),
      batchSize: events.length,
      cycleDurationMs: Date.now() - cycleStartAt,
      processedCount,
      failedCount,
      ...(Object.keys(processedByEventType).length > 0 ? { processedByEventType } : {}),
      ...(Object.keys(failedByClass).length > 0 ? { failedByClass } : {}),
    });
  }
}
