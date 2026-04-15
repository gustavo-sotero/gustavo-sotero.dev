/**
 * Canonical BullMQ-safe deterministic job ID builders.
 *
 * BullMQ v5+ rejects custom jobId values containing `:` at runtime.
 * All queue producers (API and worker) must import these helpers instead of
 * constructing job ID strings locally, so the format stays consistent and
 * valid across both processes.
 *
 * Format rules:
 *  - Must not contain `:` (BullMQ reserved separator).
 *  - Must not be a pure integer string (to avoid collisions with BullMQ internals).
 *  - Must be deterministic for the same logical entity (for deduplication).
 *  - Hyphens preserve readability in logs and operational tooling.
 */

/**
 * Deterministic job ID for an image-optimize outbox event.
 * Using the outbox event UUID guarantees BullMQ deduplication when the relay
 * runs more than once before marking the row as processed.
 */
export function imageOptimizeJobId(outboxEventId: string): string {
  return `outbox-${outboxEventId}`;
}

/**
 * Deterministic job ID for a scheduled post-publish job.
 * The same postId always resolves to the same ID, enabling at-most-once
 * scheduling and safe cancellation via `cancelScheduledPostPublish`.
 */
export function scheduledPostPublishJobId(postId: number): string {
  return `post-publish-${postId}`;
}

/**
 * Deterministic job ID for an AI post draft generation run.
 * Using the runId (UUID from the ai_post_generation_draft_runs table) ensures
 * BullMQ deduplicates duplicate outbox deliveries.
 */
export function aiPostDraftRunJobId(runId: string): string {
  return `ai-draft-run-${runId}`;
}

/**
 * Deterministic job ID for an AI post topic generation run.
 * Using the runId (UUID from the ai_post_generation_topic_runs table) ensures
 * BullMQ deduplicates duplicate outbox deliveries.
 */
export function aiPostTopicRunJobId(runId: string): string {
  return `ai-topic-run-${runId}`;
}

/**
 * Legacy job ID format used before the colon-separator was removed.
 * Kept only for compatibility lookup during the transition window:
 * existing delayed jobs in Redis may still carry this format.
 * Must not be used when enqueuing new jobs.
 *
 * @deprecated Use `scheduledPostPublishJobId` for all new job enqueuing.
 */
export function legacyScheduledPostPublishJobId(postId: number): string {
  return `post-publish:${postId}`;
}
