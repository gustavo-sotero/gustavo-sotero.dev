/**
 * Canonical BullMQ queue names used by both the API (producer) and
 * the Worker (consumer) processes.
 *
 * Import from `@portfolio/shared` or `@portfolio/shared/constants/queues`
 * rather than duplicating these string literals.
 *
 * IMPORTANT: changing a name here renames the Redis key used by BullMQ.
 * Any jobs that were enqueued under the old name will be orphaned.
 * Coordinate queue renames with a zero-downtime deployment strategy.
 */

export const QUEUE_NAMES = {
  TELEGRAM_NOTIFICATIONS: 'telegram-notifications',
  TELEGRAM_NOTIFICATIONS_DLQ: 'telegram-notifications-dlq',
  ANALYTICS_EVENTS: 'analytics-events',
  IMAGE_OPTIMIZE: 'image-optimize',
  IMAGE_OPTIMIZE_DLQ: 'image-optimize-dlq',
  DATA_RETENTION: 'data-retention',
  POST_PUBLISH: 'post-publish',
  AI_POST_DRAFT_GENERATION: 'ai-post-draft-generation',
  AI_POST_TOPIC_GENERATION: 'ai-post-topic-generation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
