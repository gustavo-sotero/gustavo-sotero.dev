/**
 * Transactional Outbox Relay
 *
 * Polls the `outbox` table for pending events and publishes them to BullMQ.
 * Using a BullMQ jobId of `outbox:{uuid}` provides idempotency — if the relay
 * runs twice before marking processed, BullMQ silently deduplicates.
 */

import { OutboxEventType } from '@portfolio/shared';
import { outbox } from '@portfolio/shared/db/schema';
import type { Queue } from 'bullmq';
import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('lib', 'outbox-relay');
let outboxSchemaMissing = false;

export const OUTBOX_MAX_ATTEMPTS = 5;

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
  postPublishQueue: Queue
): Promise<void> {
  let events: (typeof outbox.$inferSelect)[];

  try {
    events = await db
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, 'pending'), lte(outbox.attempts, OUTBOX_MAX_ATTEMPTS - 1)))
      .orderBy(asc(outbox.createdAt))
      .limit(20);
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

  for (const event of events) {
    try {
      if (event.eventType === OutboxEventType.IMAGE_OPTIMIZE) {
        const payload = event.payload as { uploadId: string };
        // jobId = `outbox:{uuid}` → BullMQ deduplicates replays automatically
        await imageQueue.add(
          OutboxEventType.IMAGE_OPTIMIZE,
          { uploadId: payload.uploadId },
          {
            jobId: `outbox:${event.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          }
        );
      } else if (event.eventType === OutboxEventType.SCHEDULED_POST_PUBLISH) {
        // Use deterministic jobId `post-publish:{postId}` so:
        //  a) BullMQ deduplicates replays when the outbox relay runs twice
        //  b) cancelScheduledPostPublish() in the API (same ID format) still works
        const payload = event.payload as { postId: number; scheduledAt: string };
        const scheduledAt = new Date(payload.scheduledAt);
        const delay = Math.max(0, scheduledAt.getTime() - Date.now());
        await postPublishQueue.add(
          'publish',
          { postId: payload.postId },
          {
            jobId: `post-publish:${payload.postId}`,
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 100 },
          }
        );
      } else {
        // Unknown event type — throw so the event enters the retry/failure path
        // rather than being silently consumed. This surfaces domain contract drift.
        throw new Error(`Unsupported outbox event type: "${event.eventType}"`);
      }

      await db
        .update(outbox)
        .set({ status: 'processed', processedAt: new Date(), lastAttemptAt: new Date() })
        .where(eq(outbox.id, event.id));

      logger.debug('Outbox relay: event published', {
        eventId: event.id,
        eventType: event.eventType,
      });
    } catch (err) {
      const newAttempts = event.attempts + 1;
      const isFinal = newAttempts >= OUTBOX_MAX_ATTEMPTS;

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

      logger.error('Outbox relay: failed to process event', {
        eventId: event.id,
        eventType: event.eventType,
        attempt: newAttempts,
        isFinal,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
