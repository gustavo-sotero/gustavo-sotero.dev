/**
 * Shared helpers for AI post generation jobs (draft + topic).
 *
 * Both jobs share identical error classification and retry-guard logic.
 * Centralising here eliminates the copy-paste and ensures both jobs evolve together.
 */

import { AiGenerationError, type AiGenerationErrorKind } from '@portfolio/shared/lib/ai-error';
import type { Job } from 'bullmq';

const CONFIG_ERROR_CODES = new Set([
  'DISABLED',
  'NOT_CONFIGURED',
  'INVALID_CONFIG',
  'NO_API_KEY',
  'CATALOG_UNAVAILABLE',
  'NO_MODEL_ID',
]);

const CONFIG_ERROR_KINDS = new Set<AiGenerationErrorKind>([
  'disabled',
  'not-configured',
  'invalid-config',
  'catalog-unavailable',
]);

export type AiJobFailureKind = AiGenerationErrorKind | 'config' | 'internal';

export interface ResolvedAiJobFailure {
  errorKind: AiJobFailureKind;
  errorCode: string | null;
  errorMessage: string;
  shouldRetry: boolean;
  status: 'failed' | 'timed_out';
  stage: 'failed' | 'timed-out';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorCode(error: unknown): string | null {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return null;
  }

  return error.code;
}

function extractErrorKind(error: unknown): string | null {
  if (!isRecord(error) || typeof error.kind !== 'string') {
    return null;
  }

  return error.kind;
}

/**
 * Classifies an unknown job error into a broad category.
 *
 * `AiGenerationError` instances are resolved before fallback classification.
 * This helper only handles raw config-shaped failures that cross process/tooling
 * boundaries without preserving the original class reference.
 */
export function classifyJobError(error: unknown): 'config' | 'internal' {
  if (extractErrorCode(error) && CONFIG_ERROR_CODES.has(extractErrorCode(error) as string)) {
    return 'config';
  }

  const errorKind = extractErrorKind(error);
  if (errorKind && CONFIG_ERROR_KINDS.has(errorKind as AiGenerationErrorKind)) {
    return 'config';
  }

  if (isRecord(error) && error.name === 'AiConfigError') {
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
  return (
    (errorKind === 'provider' || errorKind === 'timeout') &&
    (job.attemptsMade ?? 0) + 1 < configuredAttempts
  );
}

export function resolveAiJobFailure(
  job: Job<{ runId: string }>,
  error: unknown
): ResolvedAiJobFailure {
  const aiError = error instanceof AiGenerationError ? error : null;
  const errorKind = aiError?.kind ?? classifyJobError(error);
  const errorCode = aiError ? null : extractErrorCode(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    errorKind,
    errorCode,
    errorMessage,
    shouldRetry: shouldRetryProviderFailure(job, errorKind),
    status: errorKind === 'timeout' ? 'timed_out' : 'failed',
    stage: errorKind === 'timeout' ? 'timed-out' : 'failed',
  };
}
