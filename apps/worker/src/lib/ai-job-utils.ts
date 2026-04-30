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
 * - `'config'`   — likely a misconfigured API key or model ID; retrying will not help.
 * - `'internal'` — unexpected runtime error; may or may not be transient.
 *
 * `AiGenerationError` instances with a `kind` field are handled at the call site
 * before this function is invoked, so this only handles non-domain errors.
 */
export function classifyJobError(error: unknown): 'config' | 'internal' {
  const message = error instanceof Error ? error.message : String(error);
  if (/OPENROUTER_API_KEY|model ID|modelId/i.test(message)) {
    return 'config';
  }
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
