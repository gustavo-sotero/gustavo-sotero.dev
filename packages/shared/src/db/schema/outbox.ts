/**
 * Transactional Outbox pattern schema.
 *
 * The outbox provides reliable event delivery by writing events atomically
 * within the same database transaction as the state change that triggers them.
 * A worker relay then reads pending rows and publishes them to BullMQ,
 * ensuring events are never lost even if the process crashes between the
 * DB write and the queue publish.
 *
 * Idempotency: the relay sets a deterministic BullMQ-safe job ID (hyphen-separated,
 * e.g. `outbox-{uuid}` for image-optimize) via the shared helpers in
 * `@portfolio/shared/lib/jobIds`. BullMQ v5+ rejects job IDs containing `:`,
 * so all producers must use the shared helpers instead of constructing IDs locally.
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { OutboxEventType } from '../../constants/enums';

export const outboxStatusEnum = pgEnum('outbox_status', ['pending', 'processed', 'failed']);

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Logical event name used by the relay to route to the correct queue. */
    eventType: varchar('event_type', { length: 100 }).$type<OutboxEventType>().notNull(),
    /** Event payload (job data) stored as JSONB for type-safe querying. */
    payload: jsonb('payload').notNull(),
    status: outboxStatusEnum('status').default('pending').notNull(),
    /** Number of relay attempts so far. */
    attempts: integer('attempts').default(0).notNull(),
    lastAttemptAt: timestamp('last_attempt_at'),
    /** Set when the relay successfully published to BullMQ. */
    processedAt: timestamp('processed_at'),
    /** Last error message from a failed relay attempt. */
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    // Relay queries: WHERE status='pending' ORDER BY created_at
    index('outbox_status_created_at_idx').on(t.status, t.createdAt),
  ]
);

export type OutboxEvent = typeof outbox.$inferSelect;
export type NewOutboxEvent = typeof outbox.$inferInsert;
