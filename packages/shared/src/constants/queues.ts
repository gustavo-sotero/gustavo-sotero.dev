import { OutboxEventType } from './enums';

/**
 * Canonical BullMQ queue names and default job names used by both the API
 * (producer) and the Worker (consumer) processes.
 *
 * Import from `@portfolio/shared/constants/queues` rather than duplicating
 * queue names, job names, or outbox routing decisions.
 *
 * IMPORTANT: changing a queue name here renames the Redis key used by BullMQ.
 * Any jobs that were enqueued under the old name will be orphaned.
 * Coordinate queue renames with a zero-downtime deployment strategy.
 */

type QueueCatalogEntry = {
  readonly name: string;
  readonly jobName: string;
  readonly producer: 'api' | 'worker' | 'outbox-relay';
  readonly consumer: 'worker' | 'none';
  readonly outboxEventType?: (typeof OutboxEventType)[keyof typeof OutboxEventType];
};

export const QUEUE_CATALOG = {
  TELEGRAM_NOTIFICATIONS: {
    name: 'telegram-notifications',
    jobName: 'notify',
    producer: 'api',
    consumer: 'worker',
  },
  TELEGRAM_NOTIFICATIONS_DLQ: {
    name: 'telegram-notifications-dlq',
    jobName: 'failed-telegram',
    producer: 'worker',
    consumer: 'none',
  },
  ANALYTICS_EVENTS: {
    name: 'analytics-events',
    jobName: 'track',
    producer: 'api',
    consumer: 'worker',
  },
  IMAGE_OPTIMIZE: {
    name: 'image-optimize',
    jobName: OutboxEventType.IMAGE_OPTIMIZE,
    producer: 'outbox-relay',
    consumer: 'worker',
    outboxEventType: OutboxEventType.IMAGE_OPTIMIZE,
  },
  IMAGE_OPTIMIZE_DLQ: {
    name: 'image-optimize-dlq',
    jobName: 'failed-optimize',
    producer: 'worker',
    consumer: 'none',
  },
  DATA_RETENTION: {
    name: 'data-retention',
    jobName: 'daily-retention',
    producer: 'worker',
    consumer: 'worker',
  },
  POST_PUBLISH: {
    name: 'post-publish',
    jobName: 'publish',
    producer: 'outbox-relay',
    consumer: 'worker',
    outboxEventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
  },
  AI_POST_DRAFT_GENERATION: {
    name: 'ai-post-draft-generation',
    jobName: OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED,
    producer: 'outbox-relay',
    consumer: 'worker',
    outboxEventType: OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED,
  },
  AI_POST_TOPIC_GENERATION: {
    name: 'ai-post-topic-generation',
    jobName: OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED,
    producer: 'outbox-relay',
    consumer: 'worker',
    outboxEventType: OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED,
  },
} as const satisfies Record<string, QueueCatalogEntry>;

export const QUEUE_NAMES = {
  TELEGRAM_NOTIFICATIONS: QUEUE_CATALOG.TELEGRAM_NOTIFICATIONS.name,
  TELEGRAM_NOTIFICATIONS_DLQ: QUEUE_CATALOG.TELEGRAM_NOTIFICATIONS_DLQ.name,
  ANALYTICS_EVENTS: QUEUE_CATALOG.ANALYTICS_EVENTS.name,
  IMAGE_OPTIMIZE: QUEUE_CATALOG.IMAGE_OPTIMIZE.name,
  IMAGE_OPTIMIZE_DLQ: QUEUE_CATALOG.IMAGE_OPTIMIZE_DLQ.name,
  DATA_RETENTION: QUEUE_CATALOG.DATA_RETENTION.name,
  POST_PUBLISH: QUEUE_CATALOG.POST_PUBLISH.name,
  AI_POST_DRAFT_GENERATION: QUEUE_CATALOG.AI_POST_DRAFT_GENERATION.name,
  AI_POST_TOPIC_GENERATION: QUEUE_CATALOG.AI_POST_TOPIC_GENERATION.name,
} as const;

export type QueueCatalogKey = keyof typeof QUEUE_CATALOG;
export type QueueName = (typeof QUEUE_NAMES)[QueueCatalogKey];

export const OUTBOX_EVENT_QUEUE_TARGETS = {
  [OutboxEventType.IMAGE_OPTIMIZE]: QUEUE_CATALOG.IMAGE_OPTIMIZE,
  [OutboxEventType.SCHEDULED_POST_PUBLISH]: QUEUE_CATALOG.POST_PUBLISH,
  [OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED]: QUEUE_CATALOG.AI_POST_DRAFT_GENERATION,
  [OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED]: QUEUE_CATALOG.AI_POST_TOPIC_GENERATION,
} as const;

export type OutboxEventQueueTarget =
  (typeof OUTBOX_EVENT_QUEUE_TARGETS)[keyof typeof OUTBOX_EVENT_QUEUE_TARGETS];

export function getOutboxQueueTarget(
  eventType: keyof typeof OUTBOX_EVENT_QUEUE_TARGETS
): OutboxEventQueueTarget {
  return OUTBOX_EVENT_QUEUE_TARGETS[eventType];
}
