/**
 * BullMQ Queue and Worker definitions for the Worker process.
 *
 * Connection strategy: pass plain ioredis options (host/port/etc.) parsed from the
 * REDIS_URL env var so BullMQ creates its own internal connection. This avoids
 * ioredis version-mismatch TypeScript errors in the monorepo caused by BullMQ
 * bundling a slightly different patch version than our top-level ioredis dep.
 */

import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Queue } from 'bullmq';
import { env } from './config/env';

const baseConnection = parseRedisUrl(env.REDIS_URL);

// ── Queue instances (for DLQ and repeatable job registration) ─────────────────

export const telegramQueue = new Queue('telegram-notifications', {
  connection: baseConnection,
});

export const telegramDlqQueue = new Queue('telegram-notifications-dlq', {
  connection: baseConnection,
});

export const analyticsQueue = new Queue('analytics-events', {
  connection: baseConnection,
});

export const imageQueue = new Queue('image-optimize', {
  connection: baseConnection,
});

export const imageDlqQueue = new Queue('image-optimize-dlq', {
  connection: baseConnection,
});

export const retentionQueue = new Queue('data-retention', {
  connection: baseConnection,
});

export const postPublishQueue = new Queue('post-publish', {
  connection: baseConnection,
});

export const aiPostDraftGenerationQueue = new Queue('ai-post-draft-generation', {
  connection: baseConnection,
});

export const aiPostTopicGenerationQueue = new Queue('ai-post-topic-generation', {
  connection: baseConnection,
});
