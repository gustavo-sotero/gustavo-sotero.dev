/**
 * BullMQ Queue instances and enqueue helpers for the API process.
 *
 * Queues are instantiated here (API side) only for producing jobs.
 * Consumption happens in apps/worker/src/queues.ts.
 *
 * Connection: we pass connection options (url) directly to BullMQ instead of
 * a shared Redis instance to avoid ioredis version-mismatch type errors in the
 * monorepo. BullMQ creates its own internal connection.
 */

import { legacyScheduledPostPublishJobId, scheduledPostPublishJobId } from '@portfolio/shared';
import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Queue } from 'bullmq';
import { env } from '../config/env';
import { getLogger } from '../config/logger';

const logger = getLogger('queues');

/** Shared base connection options for all queues in the API process. */
function makeQueueOpts(defaultJobOptions?: object) {
  return {
    connection: { lazyConnect: true, ...parseRedisUrl(env.REDIS_URL) },
    ...(defaultJobOptions ? { defaultJobOptions } : {}),
  };
}

// ── Queue instances ───────────────────────────────────────────────────────────

export const telegramQueue = new Queue(
  'telegram-notifications',
  makeQueueOpts({
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  })
);

export const analyticsQueue = new Queue(
  'analytics-events',
  makeQueueOpts({
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 50 },
  })
);

export const imageQueue = new Queue(
  'image-optimize',
  makeQueueOpts({
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  })
);

/** Dead-letter queues — used for monitoring failed jobs. */
export const telegramDlqQueue = new Queue(
  'telegram-notifications-dlq',
  makeQueueOpts({ removeOnComplete: { count: 500 } })
);

export const imageDlqQueue = new Queue(
  'image-optimize-dlq',
  makeQueueOpts({ removeOnComplete: { count: 500 } })
);

/** Queue for scheduled post publication jobs. */
export const postPublishQueue = new Queue(
  'post-publish',
  makeQueueOpts({
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  })
);

// ── Enqueue helpers ───────────────────────────────────────────────────────────

export interface TelegramNotificationData {
  type: 'comment' | 'contact';
  postTitle?: string;
  authorName?: string;
  contentPreview?: string;
  name?: string;
  email?: string;
  messagePreview?: string;
}

/**
 * Enqueue a Telegram notification (comment or contact).
 * Best-effort contract: failures are logged and never thrown to callers.
 */
export async function enqueueTelegramNotification(data: TelegramNotificationData): Promise<void> {
  try {
    await telegramQueue.add('notify', data);
  } catch (err) {
    logger.error('Failed to enqueue Telegram notification', { error: (err as Error).message });
  }
}

export interface AnalyticsEventData {
  path: string;
  method: string;
  statusCode: number;
  userAgent?: string | null;
  ip: string;
  country?: string | null;
  timestamp: number;
}

/** Enqueue an analytics event (fire-and-forget, non-blocking). */
export function enqueueAnalyticsEvent(data: AnalyticsEventData): void {
  analyticsQueue.add('track', data).catch((err) => {
    logger.error('Failed to enqueue analytics event', { error: (err as Error).message });
  });
}

/** Enqueue an image optimization job after upload confirmation. */
export async function enqueueImageOptimize(uploadId: string): Promise<void> {
  await imageQueue.add(
    'optimize',
    { uploadId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: false,
    }
  );
}

export interface PostPublishJobData {
  postId: number;
}

/**
 * Enqueue a delayed job to publish a post at `scheduledAt` (UTC).
 *
 * Secondary utility only: the authoritative application flow for scheduled posts is
 * `posts.service -> outbox row -> worker outbox relay -> BullMQ job`.
 * Keep this helper for isolated queue tests and operational/manual use-cases, but do not
 * reintroduce direct enqueue from the post services for normal scheduling/rescheduling.
 *
 * If a job for this post already exists in the delayed state, it will be
 * rescheduled to the new time. If it is in any other state (completed, failed,
 * waiting) it is removed and re-added to reset the timeline cleanly.
 */
export async function enqueueScheduledPostPublish(
  postId: number,
  scheduledAt: Date
): Promise<void> {
  const jobId = scheduledPostPublishJobId(postId);
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const existing = await postPublishQueue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === 'delayed') {
      // Reschedule in-place via changeDelay (BullMQ ≥ 5.x supports this)
      await existing.changeDelay(delay);
      logger.info('Rescheduled post-publish job', { jobId, postId, delay });
      return;
    }
    // Job is in any other state (completed, failed, waiting, active) — remove and recreate
    await existing.remove().catch(() => {
      /* already gone — safe to ignore */
    });
  }

  await postPublishQueue.add('publish', { postId }, { jobId, delay });
  logger.info('Enqueued post-publish job', { jobId, postId, delay });
}

/**
 * Cancel a pending post-publish job.
 * Tries the current safe format first, then falls back to the legacy format
 * to handle jobs that were enqueued before the colon-separator was removed.
 * No-op if no matching job exists or the job has already been processed.
 */
export async function cancelScheduledPostPublish(postId: number): Promise<void> {
  const jobId = scheduledPostPublishJobId(postId);
  let resolvedJobId = jobId;
  let usedLegacyFormat = false;
  let existing = await postPublishQueue.getJob(jobId);

  if (!existing) {
    // Compatibility lookup: job may have been enqueued under the legacy
    // `post-publish:{postId}` format before the colon-separator was removed.
    const legacyJobId = legacyScheduledPostPublishJobId(postId);
    existing = await postPublishQueue.getJob(legacyJobId);
    if (existing) {
      resolvedJobId = legacyJobId;
      usedLegacyFormat = true;
    }
  }

  if (!existing) return;

  const state = await existing.getState();
  if (state === 'delayed' || state === 'waiting') {
    await existing.remove().catch(() => {
      /* already gone — safe to ignore */
    });
    logger.info('Cancelled post-publish job', {
      jobId: existing.opts.jobId ?? resolvedJobId,
      jobIdFormat: usedLegacyFormat ? 'legacy' : 'current',
      postId,
    });
  }
}
