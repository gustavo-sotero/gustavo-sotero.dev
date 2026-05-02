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
import {
  collectManagedQueues,
  collectObservedQueues,
  createWorkers,
  defineWorkerSpec,
} from './lib/worker-registry';
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

const workerSpecs = [
  defineWorkerSpec<TelegramJobPayload>({
    queueName: QUEUE_NAMES.TELEGRAM_NOTIFICATIONS,
    queue: telegramQueue,
    processor: (job) => processTelegram(job),
    concurrency: 2,
    dlq: {
      queue: telegramDlqQueue,
      jobName: QUEUE_CATALOG.TELEGRAM_NOTIFICATIONS_DLQ.jobName,
      observedKey: QUEUE_NAMES.TELEGRAM_NOTIFICATIONS_DLQ,
      maxAttempts: 5,
    },
    logLabel: 'Telegram notification',
    observed: true,
    completedLogFields: (job) => ({ type: job.data.type }),
    failedLogFields: (job) => ({ type: job.data.type }),
  }),
  defineWorkerSpec<AnalyticsEventPayload>({
    queueName: QUEUE_NAMES.ANALYTICS_EVENTS,
    queue: analyticsQueue,
    processor: (job) => processAnalytics(job),
    concurrency: 10,
    logLabel: 'Analytics event',
    observed: true,
  }),
  defineWorkerSpec<ImageOptimizePayload>({
    queueName: QUEUE_NAMES.IMAGE_OPTIMIZE,
    queue: imageQueue,
    processor: (job) => processImageOptimize(job),
    concurrency: 2,
    dlq: {
      queue: imageDlqQueue,
      jobName: QUEUE_CATALOG.IMAGE_OPTIMIZE_DLQ.jobName,
      observedKey: QUEUE_NAMES.IMAGE_OPTIMIZE_DLQ,
      maxAttempts: 3,
    },
    logLabel: 'Image optimize',
    observed: true,
    completedLogFields: (job) => ({ uploadId: job.data.uploadId }),
    failedLogFields: (job) => ({ uploadId: job.data.uploadId }),
  }),
  defineWorkerSpec<PostPublishJobData>({
    queueName: QUEUE_NAMES.POST_PUBLISH,
    queue: postPublishQueue,
    processor: (job, token) => processPostPublish(job, token),
    concurrency: 5,
    logLabel: 'Post-publish',
    observed: true,
    completedLogFields: (job) => ({ postId: job.data.postId }),
    failedLogFields: (job) => ({ postId: job.data.postId }),
  }),
  defineWorkerSpec({
    queueName: QUEUE_NAMES.DATA_RETENTION,
    queue: retentionQueue,
    processor: () => processRetention(),
    concurrency: 1,
    logLabel: 'Retention',
    observed: true,
  }),
  defineWorkerSpec<AiPostDraftJobData>({
    queueName: QUEUE_NAMES.AI_POST_DRAFT_GENERATION,
    queue: aiPostDraftGenerationQueue,
    processor: (job) => processAiPostDraftGeneration(job),
    concurrency: 2,
    logLabel: 'AI draft generation',
    observed: true,
    completedLogFields: (job) => ({ runId: job.data.runId }),
    failedLogFields: (job) => ({ runId: job.data.runId }),
  }),
  defineWorkerSpec<AiPostTopicJobData>({
    queueName: QUEUE_NAMES.AI_POST_TOPIC_GENERATION,
    queue: aiPostTopicGenerationQueue,
    processor: (job) => processAiPostTopicGeneration(job),
    concurrency: 2,
    logLabel: 'AI topic generation',
    observed: true,
    completedLogFields: (job) => ({ runId: job.data.runId }),
    failedLogFields: (job) => ({ runId: job.data.runId }),
  }),
] as const;

const workers = createWorkers(workerSpecs, workerConnection, logger);
const managedQueues = collectManagedQueues(workerSpecs);
const observedQueues = collectObservedQueues(workerSpecs);

// ── Register repeatable retention job (daily at 03:00 UTC) ───────────────────
await retentionQueue
  .add(QUEUE_CATALOG.DATA_RETENTION.jobName, {}, { repeat: { pattern: '0 3 * * *' } })
  .catch((err) => {
    logger.error('Failed to register retention repeatable job', {
      error: (err as Error).message,
    });
  });

logger.info('All workers ready', {
  queues: workerSpecs.map((spec) => spec.queueName),
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
  await Promise.allSettled(workers.map((worker) => worker.close()));

  // Close Queue instances (each holds its own ioredis connection)
  await Promise.allSettled([...managedQueues.map((queue) => queue.close()), closeCacheRedis()]);

  await pgClient.end();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
