import { QUEUE_NAMES } from '@portfolio/shared';
import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Queue } from 'bullmq';
import { env } from './config/env';

const baseConnection = parseRedisUrl(env.REDIS_URL);

// ── Queue instances (for DLQ and repeatable job registration) ─────────────────

export const telegramQueue = new Queue(QUEUE_NAMES.TELEGRAM_NOTIFICATIONS, {
  connection: baseConnection,
});

export const telegramDlqQueue = new Queue(QUEUE_NAMES.TELEGRAM_NOTIFICATIONS_DLQ, {
  connection: baseConnection,
});

export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS_EVENTS, {
  connection: baseConnection,
});

export const imageQueue = new Queue(QUEUE_NAMES.IMAGE_OPTIMIZE, {
  connection: baseConnection,
});

export const imageDlqQueue = new Queue(QUEUE_NAMES.IMAGE_OPTIMIZE_DLQ, {
  connection: baseConnection,
});

export const retentionQueue = new Queue(QUEUE_NAMES.DATA_RETENTION, {
  connection: baseConnection,
});

export const postPublishQueue = new Queue(QUEUE_NAMES.POST_PUBLISH, {
  connection: baseConnection,
});

export const aiPostDraftGenerationQueue = new Queue(QUEUE_NAMES.AI_POST_DRAFT_GENERATION, {
  connection: baseConnection,
});

export const aiPostTopicGenerationQueue = new Queue(QUEUE_NAMES.AI_POST_TOPIC_GENERATION, {
  connection: baseConnection,
});
