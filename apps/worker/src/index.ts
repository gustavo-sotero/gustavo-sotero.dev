import { getLogger, setupLogger } from './config/logger';

await setupLogger();

import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Worker } from 'bullmq';
import { client as pgClient } from './config/db';
import { env } from './config/env';
import { type AnalyticsEventPayload, processAnalytics } from './jobs/analytics';
import { type ImageOptimizePayload, processImageOptimize } from './jobs/imageOptimize';
import { type PostPublishJobData, processPostPublish } from './jobs/postPublish';
import { processRetention } from './jobs/retention';
import { processTelegram, type TelegramJobPayload } from './jobs/telegram';
import { closeCacheRedis } from './lib/cache';
import { processOutboxEvents } from './lib/outbox-relay';
import {
  analyticsQueue,
  imageDlqQueue,
  imageQueue,
  postPublishQueue,
  retentionQueue,
  telegramDlqQueue,
  telegramQueue,
} from './queues';

const logger = getLogger();

logger.info('Worker starting', { env: env.NODE_ENV, pid: process.pid });

const workerConnection = parseRedisUrl(env.REDIS_URL);

// ── Telegram Worker ───────────────────────────────────────────────────────────
const telegramWorker = new Worker<TelegramJobPayload>(
  'telegram-notifications',
  async (job) => {
    await processTelegram(job);
  },
  {
    connection: workerConnection,
    concurrency: 2,
  }
);

telegramWorker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 5;
  if (job.attemptsMade >= maxAttempts) {
    logger.error('Telegram job moved to DLQ after all retries exhausted', {
      jobId: job.id,
      type: job.data.type,
      error: err.message,
    });
    await telegramDlqQueue
      .add('failed-telegram', {
        originalJob: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
        jobId: job.id,
      })
      .catch((dlqErr) => {
        logger.error('Failed to add Telegram job to DLQ', {
          error: (dlqErr as Error).message,
        });
      });
  }
});

telegramWorker.on('completed', (job) => {
  logger.info('Telegram notification sent', { jobId: job.id, type: job.data.type });
});

telegramWorker.on('error', (err) => {
  logger.error('Telegram worker error', { error: err.message });
});

// ── Analytics Worker ──────────────────────────────────────────────────────────
const analyticsWorker = new Worker<AnalyticsEventPayload>(
  'analytics-events',
  async (job) => {
    await processAnalytics(job);
  },
  {
    connection: workerConnection,
    concurrency: 10,
  }
);

analyticsWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.error('Analytics job failed', { jobId: job.id, error: err.message });
});

analyticsWorker.on('error', (err) => {
  logger.error('Analytics worker error', { error: err.message });
});

// ── Image Optimize Worker ─────────────────────────────────────────────────────
const imageWorker = new Worker<ImageOptimizePayload>(
  'image-optimize',
  async (job) => {
    await processImageOptimize(job);
  },
  {
    connection: workerConnection,
    concurrency: 2,
  }
);

imageWorker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 3;
  if (job.attemptsMade >= maxAttempts) {
    logger.error('Image optimize job moved to DLQ after all retries exhausted', {
      jobId: job.id,
      uploadId: job.data.uploadId,
      error: err.message,
    });
    await imageDlqQueue
      .add('failed-optimize', {
        originalJob: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
        jobId: job.id,
      })
      .catch((dlqErr) => {
        logger.error('Failed to add image job to DLQ', {
          error: (dlqErr as Error).message,
        });
      });
  }
});

imageWorker.on('completed', (job) => {
  logger.info('Image optimization job completed', {
    jobId: job.id,
    uploadId: job.data.uploadId,
  });
});

imageWorker.on('error', (err) => {
  logger.error('Image worker error', { error: err.message });
});

// ── Post Publish Worker ───────────────────────────────────────────────────────
const postPublishWorker = new Worker<PostPublishJobData>(
  'post-publish',
  async (job, token) => {
    await processPostPublish(job, token);
  },
  {
    connection: workerConnection,
    concurrency: 5,
  }
);

postPublishWorker.on('completed', (job) => {
  logger.info('Post-publish job completed', { jobId: job.id, postId: job.data.postId });
});

postPublishWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.error('Post-publish job failed', {
    jobId: job.id,
    postId: job.data.postId,
    attempt: job.attemptsMade,
    error: err.message,
  });
});

postPublishWorker.on('error', (err) => {
  logger.error('Post-publish worker error', { error: err.message });
});

// ── Retention Worker ──────────────────────────────────────────────────────────
const retentionWorker = new Worker(
  'data-retention',
  async () => {
    await processRetention();
  },
  {
    connection: workerConnection,
    concurrency: 1,
  }
);

retentionWorker.on('completed', (job) => {
  logger.info('Retention job completed', { jobId: job.id });
});

retentionWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.error('Retention job failed', { jobId: job.id, error: err.message });
});

retentionWorker.on('error', (err) => {
  logger.error('Retention worker error', { error: err.message });
});

// ── Register repeatable retention job (daily at 03:00 UTC) ───────────────────
await retentionQueue
  .add('daily-retention', {}, { repeat: { pattern: '0 3 * * *' } })
  .catch((err) => {
    logger.error('Failed to register retention repeatable job', {
      error: (err as Error).message,
    });
  });

logger.info('All workers ready', {
  queues: [
    'telegram-notifications',
    'analytics-events',
    'image-optimize',
    'data-retention',
    'post-publish',
  ],
});

// ── Transactional Outbox Relay ────────────────────────────────────────────────
// Polls the `outbox` table for pending events and publishes them to BullMQ.
// processOutboxEvents is defined in ./lib/outbox-relay (extracted for testability).
//
// In-flight guard rationale:
//   Under normal load each relay run completes well within the poll interval
//   (simple SELECT + queue.add + UPDATE per batch). However, under a slow DB
//   or during a large backlog flush, a run could theoretically exceed the
//   interval. Two concurrent relay executions would each SELECT the same
//   pending events; BullMQ's `jobId = outbox-{uuid}` deduplication prevents
//   duplicate jobs, and the DB UPDATE is idempotent (setting status='processed'
//   twice is harmless). The flag below is therefore a belt-and-braces guard
//   that avoids the additional DB + queue pressure of a concurrent batch and
//   eliminates noisy duplicate log entries, without relying solely on
//   downstream idempotency for correctness.

const OUTBOX_POLL_INTERVAL_MS = 5_000;
let relayInFlight = false;

async function runOutboxRelay(): Promise<void> {
  if (relayInFlight) return;
  relayInFlight = true;
  try {
    await processOutboxEvents(imageQueue, postPublishQueue);
  } finally {
    relayInFlight = false;
  }
}

// Initial run on startup then poll on interval
runOutboxRelay().catch((err) => {
  logger.error('Outbox relay initial run failed', {
    error: err instanceof Error ? err.message : String(err),
  });
});
const outboxInterval = setInterval(() => {
  runOutboxRelay().catch((err) => {
    logger.error('Outbox relay poll failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}, OUTBOX_POLL_INTERVAL_MS);

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info('Worker received shutdown signal', { signal });

  // Stop outbox relay before closing connections
  clearInterval(outboxInterval);

  // Close workers first (stop consuming new jobs)
  await Promise.allSettled([
    telegramWorker.close(),
    analyticsWorker.close(),
    imageWorker.close(),
    retentionWorker.close(),
    postPublishWorker.close(),
  ]);

  // Close Queue instances (each holds its own ioredis connection)
  await Promise.allSettled([
    telegramQueue.close(),
    telegramDlqQueue.close(),
    analyticsQueue.close(),
    imageQueue.close(),
    imageDlqQueue.close(),
    retentionQueue.close(),
    postPublishQueue.close(),
    closeCacheRedis(),
  ]);

  await pgClient.end();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
