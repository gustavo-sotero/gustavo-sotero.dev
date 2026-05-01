/**
 * Shared helpers for AI post generation jobs (draft + topic).
 *
 * Both jobs share identical error classification and retry-guard logic.
 * Centralising here eliminates the copy-paste and ensures both jobs evolve together.
 */

import type { Job } from 'bullmq';

/**
 * Classifies an unknown job error into a broad category.
 *
 * `AiGenerationError` instances with a `kind` field are handled at the call site
 * before this function is invoked. Any remaining raw error is therefore treated
 * as an unexpected internal failure instead of being classified by message text.
 */
export function classifyJobError(_error: unknown): 'internal' {
  return 'internal';
}

/**
 * Returns `true` when a provider-level failure (rate limits, 5xx, timeouts from
 * the AI provider) should trigger a BullMQ retry rather than a terminal failure.
 *
 * Retries are only allowed when the job has configured attempts remaining.
 */
export function shouldRetryProviderFailure(
  job: Job<{ runId: string }>,
  errorKind: string
): boolean {
  const configuredAttempts = job.opts?.attempts ?? 1;
  return errorKind === 'provider' && (job.attemptsMade ?? 0) + 1 < configuredAttempts;
}
