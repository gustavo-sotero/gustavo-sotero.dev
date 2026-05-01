import { getLogger, setupLogger } from './config/logger';

await setupLogger();

import { QUEUE_CATALOG, QUEUE_NAMES } from '@portfolio/shared/constants/queues';
import { parseRedisUrl } from '@portfolio/shared/lib/redis';
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
import { createWorker } from './lib/worker-registry';
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

// ── Worker definitions ────────────────────────────────────────────────────────

const telegramWorker = createWorker<TelegramJobPayload>(
  {
    queueName: QUEUE_NAMES.TELEGRAM_NOTIFICATIONS,
    processor: (job) => processTelegram(job),
    concurrency: 2,
    dlq: {
      queue: telegramDlqQueue,
      jobName: QUEUE_CATALOG.TELEGRAM_NOTIFICATIONS_DLQ.jobName,
      maxAttempts: 5,
    },
    logLabel: 'Telegram notification',
    completedLogFields: (job) => ({ type: job.data.type }),
    failedLogFields: (job) => ({ type: job.data.type }),
  },
  workerConnection,
  logger
);

const analyticsWorker = createWorker<AnalyticsEventPayload>(
  {
    queueName: QUEUE_NAMES.ANALYTICS_EVENTS,
    processor: (job) => processAnalytics(job),
    concurrency: 10,
    logLabel: 'Analytics event',
  },
  workerConnection,
  logger
);

const imageWorker = createWorker<ImageOptimizePayload>(
  {
    queueName: QUEUE_NAMES.IMAGE_OPTIMIZE,
    processor: (job) => processImageOptimize(job),
    concurrency: 2,
    dlq: {
      queue: imageDlqQueue,
      jobName: QUEUE_CATALOG.IMAGE_OPTIMIZE_DLQ.jobName,
      maxAttempts: 3,
    },
    logLabel: 'Image optimize',
    completedLogFields: (job) => ({ uploadId: job.data.uploadId }),
    failedLogFields: (job) => ({ uploadId: job.data.uploadId }),
  },
  workerConnection,
  logger
);

const postPublishWorker = createWorker<PostPublishJobData>(
  {
    queueName: QUEUE_NAMES.POST_PUBLISH,
    processor: (job, token) => processPostPublish(job, token),
    concurrency: 5,
    logLabel: 'Post-publish',
    completedLogFields: (job) => ({ postId: job.data.postId }),
    failedLogFields: (job) => ({ postId: job.data.postId }),
  },
  workerConnection,
  logger
);

const retentionWorker = createWorker(
  {
    queueName: QUEUE_NAMES.DATA_RETENTION,
    processor: () => processRetention(),
    concurrency: 1,
    logLabel: 'Retention',
  },
  workerConnection,
  logger
);

const aiPostDraftWorker = createWorker<AiPostDraftJobData>(
  {
    queueName: QUEUE_NAMES.AI_POST_DRAFT_GENERATION,
    processor: (job) => processAiPostDraftGeneration(job),
    concurrency: 2,
    logLabel: 'AI draft generation',
    completedLogFields: (job) => ({ runId: job.data.runId }),
    failedLogFields: (job) => ({ runId: job.data.runId }),
  },
  workerConnection,
  logger
);

const aiPostTopicWorker = createWorker<AiPostTopicJobData>(
  {
    queueName: QUEUE_NAMES.AI_POST_TOPIC_GENERATION,
    processor: (job) => processAiPostTopicGeneration(job),
    concurrency: 2,
    logLabel: 'AI topic generation',
    completedLogFields: (job) => ({ runId: job.data.runId }),
    failedLogFields: (job) => ({ runId: job.data.runId }),
  },
  workerConnection,
  logger
);

// ── Register repeatable retention job (daily at 03:00 UTC) ───────────────────
await retentionQueue
  .add(QUEUE_CATALOG.DATA_RETENTION.jobName, {}, { repeat: { pattern: '0 3 * * *' } })
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

const OUTBOX_POLL_INTERVAL_MS = env.OUTBOX_POLL_INTERVAL_MS;
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
      aiPostTopicGenerationQueue,
      { batchSize: env.OUTBOX_BATCH_SIZE }
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
