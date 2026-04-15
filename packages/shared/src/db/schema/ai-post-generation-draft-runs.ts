/**
 * Durable async draft generation run table.
 *
 * Persists the full lifecycle of an AI post draft generation request from
 * initial queue insertion through worker execution to terminal state.
 *
 * Each row represents one draft generation attempt triggered by the admin.
 * The worker claims a queued run, updates stages as it progresses, and writes
 * the final result (or error) into this table.
 *
 * Status contract:
 *  queued    — created, outbox event written, waiting for worker to claim
 *  running   — worker claimed the run and is executing
 *  validating — provider call done, normalizing/validating output
 *  completed — run finished successfully; result_payload is populated
 *  failed    — run terminated with an error; error fields are populated
 *  timed_out — provider call exceeded the configured AI timeout
 *
 * Stage contract (more granular; used for UI copy and debugging):
 *  queued / resolving-config / building-prompt / requesting-provider /
 *  normalizing-output / canonicalizing-tags / validating-output /
 *  persisting-result / completed / failed / timed-out
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

export const aiPostDraftRunStatusEnum = pgEnum('ai_post_draft_run_status', [
  'queued',
  'running',
  'validating',
  'completed',
  'failed',
  'timed_out',
]);

export const aiPostDraftRuns = pgTable(
  'ai_post_generation_draft_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // ── Execution state ────────────────────────────────────────────────────────
    status: aiPostDraftRunStatusEnum('status').default('queued').notNull(),
    /** Fine-grained execution stage for UI copy and debugging. */
    stage: varchar('stage', { length: 64 }).default('queued').notNull(),

    // ── Request context ────────────────────────────────────────────────────────
    /** The category as requested (may be 'misto'). */
    requestedCategory: varchar('requested_category', { length: 128 }).notNull(),
    /** Resolved concrete category (set once a topic suggestion is identified). */
    concreteCategory: varchar('concrete_category', { length: 128 }),
    /** Full validated request payload (GenerateDraftRequest). */
    requestPayload: jsonb('request_payload').notNull(),
    /** Model ID that was active when the run was created. */
    modelId: varchar('model_id', { length: 255 }),

    // ── Result / error ─────────────────────────────────────────────────────────
    /** Normalized GenerateDraftResponse — null until completed. */
    resultPayload: jsonb('result_payload'),
    /** Error kind (timeout | refusal | validation | provider | config | internal). */
    errorKind: varchar('error_kind', { length: 64 }),
    /** Machine-readable error code from AiGenerationError or internal logic. */
    errorCode: varchar('error_code', { length: 128 }),
    /** Human-readable error message (PT-BR where possible). */
    errorMessage: text('error_message'),
    /** Provider's generation ID for tracing (when available). */
    providerGenerationId: varchar('provider_generation_id', { length: 255 }),

    // ── Execution metadata ─────────────────────────────────────────────────────
    attemptCount: integer('attempt_count').default(0).notNull(),
    /** GitHub ID of the admin who triggered the run. */
    createdBy: varchar('created_by', { length: 255 }),

    // ── Timestamps ─────────────────────────────────────────────────────────────
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Updated by the worker when transitioning stages (for orphan detection). */
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // For polling and status-based filtering
    index('idx_ai_draft_runs_status_created').on(t.status, t.createdAt),
    // For listing runs by admin
    index('idx_ai_draft_runs_created_by_created').on(t.createdBy, t.createdAt),
    // For retention cleanup
    index('idx_ai_draft_runs_created_at').on(t.createdAt),
  ]
);

export type AiPostDraftRun = typeof aiPostDraftRuns.$inferSelect;
export type NewAiPostDraftRun = typeof aiPostDraftRuns.$inferInsert;
