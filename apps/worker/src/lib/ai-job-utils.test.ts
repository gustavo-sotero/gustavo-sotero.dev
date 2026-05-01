import { AiGenerationError } from '@portfolio/shared/lib/ai-error';
import type { Job } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { classifyJobError, resolveAiJobFailure, shouldRetryProviderFailure } from './ai-job-utils';

function makeJob(attemptsMade: number, attempts: number): Job<{ runId: string }> {
  return {
    attemptsMade,
    opts: { attempts },
  } as Job<{ runId: string }>;
}

describe('ai-job-utils', () => {
  describe('classifyJobError', () => {
    it('classifies config-shaped errors by code', () => {
      const error = Object.assign(new Error('missing model'), { code: 'NO_MODEL_ID' });

      expect(classifyJobError(error)).toBe('config');
    });

    it('classifies AiConfigError-shaped failures by name', () => {
      const error = { name: 'AiConfigError', message: 'not configured' };

      expect(classifyJobError(error)).toBe('config');
    });

    it('falls back to internal for generic failures', () => {
      expect(classifyJobError(new Error('boom'))).toBe('internal');
    });
  });

  describe('shouldRetryProviderFailure', () => {
    it('retries provider failures while attempts remain', () => {
      expect(shouldRetryProviderFailure(makeJob(0, 2), 'provider')).toBe(true);
    });

    it('retries timeouts while attempts remain', () => {
      expect(shouldRetryProviderFailure(makeJob(0, 2), 'timeout')).toBe(true);
    });

    it('stops retrying after the final configured attempt', () => {
      expect(shouldRetryProviderFailure(makeJob(1, 2), 'timeout')).toBe(false);
    });
  });

  describe('resolveAiJobFailure', () => {
    it('preserves timeout kind and marks it retryable before the last attempt', () => {
      const failure = resolveAiJobFailure(
        makeJob(0, 2),
        new AiGenerationError('timeout', 'provider timed out')
      );

      expect(failure).toMatchObject({
        errorKind: 'timeout',
        errorCode: null,
        errorMessage: 'provider timed out',
        shouldRetry: true,
        status: 'timed_out',
        stage: 'timed-out',
      });
    });

    it('maps raw config failures into a terminal failed state', () => {
      const failure = resolveAiJobFailure(
        makeJob(0, 2),
        Object.assign(new Error('Run created without a resolved model ID.'), {
          code: 'NO_MODEL_ID',
        })
      );

      expect(failure).toMatchObject({
        errorKind: 'config',
        errorCode: 'NO_MODEL_ID',
        errorMessage: 'Run created without a resolved model ID.',
        shouldRetry: false,
        status: 'failed',
        stage: 'failed',
      });
    });
  });
});
