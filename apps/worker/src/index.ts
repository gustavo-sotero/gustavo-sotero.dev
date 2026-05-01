import { getLogger, setupLogger } from './config/logger';

await setupLogger();

import { QUEUE_CATALOG, QUEUE_NAMES } from '@portfolio/shared/constants/queues';
import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Worker } from 'bullmq';
import { client as pgClient } from './config/db';
import { env } from './config/env';
import {
  type AiPostDraftJobData,
  processAiPostDraftGeneration,
} from './jobs/ai-post-draft-generation';
import {
  type AiPostTopicJobData,
  processAiPostTopicGeneration,
} from './jobs/ai-post-topic-generation';
import { type AnalyticsEventPayload, processAnalytics } from './jobs/analytics';
import { type ImageOptimizePayload, processImageOptimize } from './jobs/imageOptimize';
import { type PostPublishJobData, processPostPublish } from './jobs/postPublish';
import { processRetention } from './jobs/retention';
import { processTelegram, type TelegramJobPayload } from './jobs/telegram';
import { closeCacheRedis } from './lib/cache';
import { processOutboxEvents } from './lib/outbox-relay';
import { createOutboxRelayPollGuard } from './lib/outbox-relay-poll-guard';
import { logQueueSnapshots } from './lib/queue-observability';
import {
  aiPostDraftGenerationQueue,
  aiPostTopicGenerationQueue,
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
  QUEUE_NAMES.TELEGRAM_NOTIFICATIONS,
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
      .add(QUEUE_CATALOG.TELEGRAM_NOTIFICATIONS_DLQ.jobName, {
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
  QUEUE_NAMES.ANALYTICS_EVENTS,
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
  QUEUE_NAMES.IMAGE_OPTIMIZE,
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
      .add(QUEUE_CATALOG.IMAGE_OPTIMIZE_DLQ.jobName, {
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
  QUEUE_NAMES.POST_PUBLISH,
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
  QUEUE_NAMES.DATA_RETENTION,
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
  .add(QUEUE_CATALOG.DATA_RETENTION.jobName, {}, { repeat: { pattern: '0 3 * * *' } })
  .catch((err) => {
    logger.error('Failed to register retention repeatable job', {
      error: (err as Error).message,
    });
  });

// ── AI Post Draft Generation Worker ──────────────────────────────────────────
const aiPostDraftWorker = new Worker<AiPostDraftJobData>(
  QUEUE_NAMES.AI_POST_DRAFT_GENERATION,
  async (job) => {
    await processAiPostDraftGeneration(job);
  },
  {
    connection: workerConnection,
    concurrency: 2,
  }
);

aiPostDraftWorker.on('completed', (job) => {
  logger.info('AI draft generation job completed', { jobId: job.id, runId: job.data.runId });
});

aiPostDraftWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.error('AI draft generation job failed', {
    jobId: job.id,
    runId: job.data.runId,
    attempt: job.attemptsMade,
    error: err.message,
  });
});

aiPostDraftWorker.on('error', (err) => {
  logger.error('AI draft generation worker error', { error: err.message });
});

// ── AI Post Topic Generation Worker ──────────────────────────────────────────
const aiPostTopicWorker = new Worker<AiPostTopicJobData>(
  QUEUE_NAMES.AI_POST_TOPIC_GENERATION,
  async (job) => {
    await processAiPostTopicGeneration(job);
  },
  {
    connection: workerConnection,
    concurrency: 2,
  }
);

aiPostTopicWorker.on('completed', (job) => {
  logger.info('AI topic generation job completed', { jobId: job.id, runId: job.data.runId });
});

aiPostTopicWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.error('AI topic generation job failed', {
    jobId: job.id,
    runId: job.data.runId,
    attempt: job.attemptsMade,
    error: err.message,
  });
});

aiPostTopicWorker.on('error', (err) => {
  logger.error('AI topic generation worker error', { error: err.message });
});

logger.info('All workers ready', {
  queues: [
    'telegram-notifications',
    'analytics-events',
    'image-optimize',
    'data-retention',
    'post-publish',
    'ai-post-draft-generation',
    'ai-post-topic-generation',
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
const QUEUE_OBSERVABILITY_INTERVAL_MS = 60_000;
const outboxRelayPollGuard = createOutboxRelayPollGuard(logger, OUTBOX_POLL_INTERVAL_MS);
const observedQueues = [
  { key: QUEUE_NAMES.TELEGRAM_NOTIFICATIONS, queue: telegramQueue },
  { key: QUEUE_NAMES.TELEGRAM_NOTIFICATIONS_DLQ, queue: telegramDlqQueue },
  { key: QUEUE_NAMES.ANALYTICS_EVENTS, queue: analyticsQueue },
  { key: QUEUE_NAMES.IMAGE_OPTIMIZE, queue: imageQueue },
  { key: QUEUE_NAMES.IMAGE_OPTIMIZE_DLQ, queue: imageDlqQueue },
  { key: QUEUE_NAMES.DATA_RETENTION, queue: retentionQueue },
  { key: QUEUE_NAMES.POST_PUBLISH, queue: postPublishQueue },
  { key: QUEUE_NAMES.AI_POST_DRAFT_GENERATION, queue: aiPostDraftGenerationQueue },
  { key: QUEUE_NAMES.AI_POST_TOPIC_GENERATION, queue: aiPostTopicGenerationQueue },
];

async function runOutboxRelay(): Promise<void> {
  if (!outboxRelayPollGuard.tryStartCycle()) return;
  try {
    await processOutboxEvents(
      imageQueue,
      postPublishQueue,
      aiPostDraftGenerationQueue,
      aiPostTopicGenerationQueue
    );
  } finally {
    outboxRelayPollGuard.finishCycle();
  }
}

async function runQueueObservabilitySnapshot(): Promise<void> {
  await logQueueSnapshots(observedQueues, logger);
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
const queueObservabilityInterval = setInterval(() => {
  runQueueObservabilitySnapshot().catch((err) => {
    logger.error('BullMQ queue snapshot failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}, QUEUE_OBSERVABILITY_INTERVAL_MS);

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info('Worker received shutdown signal', { signal });

  // Stop outbox relay before closing connections
  clearInterval(outboxInterval);
  clearInterval(queueObservabilityInterval);

  // Close workers first (stop consuming new jobs)
  await Promise.allSettled([
    telegramWorker.close(),
    analyticsWorker.close(),
    imageWorker.close(),
    retentionWorker.close(),
    postPublishWorker.close(),
    aiPostDraftWorker.close(),
    aiPostTopicWorker.close(),
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
    aiPostDraftGenerationQueue.close(),
    aiPostTopicGenerationQueue.close(),
    closeCacheRedis(),
  ]);

  await pgClient.end();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
