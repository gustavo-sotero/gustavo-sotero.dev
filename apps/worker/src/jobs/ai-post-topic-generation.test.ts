/**
 * Tests for the AI post topic generation worker job.
 *
 * Covers:
 * - Idempotent claim guard: already-claimed run is skipped
 * - Missing modelId path: run fails with NO_MODEL_ID
 * - Successful full execution: stages → completed with resultPayload
 * - Timeout: timed_out status + re-throw
 * - Transient provider failure: failed status + re-throw (BullMQ retries)
 * - Provider retry: re-queues when another attempt remains
 * - Validation failure: schema rejects output → failed with validation kind
 * - attemptCount recorded from job.attemptsMade
 */

import { AiGenerationError } from '@portfolio/shared';
import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  dbSelectMock,
  dbUpdateMock,
  updateSetMock,
  updateWhereMock,
  returningMock,
  generateStructuredObjectMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  returningMock: vi.fn(),
  generateStructuredObjectMock: vi.fn(),
}));

// ── Mock wiring ───────────────────────────────────────────────────────────────

dbUpdateMock.mockImplementation(() => ({ set: updateSetMock }));
updateSetMock.mockImplementation(() => ({ where: updateWhereMock }));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: dbUpdateMock,
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../lib/ai/generateStructuredObject', () => ({
  generateStructuredObject: generateStructuredObjectMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  aiPostTopicRuns: { id: Symbol('id'), status: Symbol('status') },
  tags: { name: Symbol('name'), slug: Symbol('slug') },
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((field) => ({ field, op: 'asc' })),
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conds) => ({ conds, op: 'and' })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { processAiPostTopicGeneration } from './ai-post-topic-generation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUN_ID = '550e8400-e29b-41d4-a716-446655440001';

function buildJob(runId = RUN_ID, attemptsMade = 0, attempts = 1): Job<{ runId: string }> {
  return {
    id: 'job-topic-1',
    attemptsMade,
    opts: { attempts },
    data: { runId },
  } as Job<{ runId: string }>;
}

function makeClaimedRun(
  overrides: Partial<{
    modelId: string | null;
    requestPayload: unknown;
  }> = {}
) {
  return {
    id: RUN_ID,
    modelId: overrides.modelId !== undefined ? overrides.modelId : 'openai/gpt-4o',
    requestPayload: overrides.requestPayload ?? {
      category: 'backend-arquitetura',
      briefing: null,
      limit: 4,
      excludedIdeas: [],
    },
  };
}

const VALID_SUGGESTION = {
  suggestionId: 's1',
  category: 'backend-arquitetura',
  proposedTitle: 'Filas vs. RPC',
  angle: 'Trade-offs de acoplamento',
  summary: 'Quando usar filas e quando o RPC síncrono é superior.',
  targetReader: 'Engenheiro backend',
  suggestedTagNames: ['TypeScript', 'BullMQ'],
  rationale: 'Tema pouco discutido em PT-BR.',
};

const VALID_AI_OBJECT = {
  suggestions: [
    VALID_SUGGESTION,
    { ...VALID_SUGGESTION, suggestionId: 's2', proposedTitle: 'Cache distribuído' },
    { ...VALID_SUGGESTION, suggestionId: 's3', proposedTitle: 'Rate limiting em APIs' },
    { ...VALID_SUGGESTION, suggestionId: 's4', proposedTitle: 'Observabilidade com OpenTelemetry' },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('processAiPostTopicGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbUpdateMock.mockImplementation(() => ({ set: updateSetMock }));
    updateSetMock.mockImplementation(() => ({ where: updateWhereMock }));
    updateWhereMock.mockResolvedValue(undefined);
    dbSelectMock.mockReturnValue({
      from: vi.fn(() => ({
        orderBy: vi.fn().mockResolvedValue([]),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips processing when run is already claimed (not in queued status)', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([]); // empty → not claimed

    await processAiPostTopicGeneration(buildJob());

    expect(generateStructuredObjectMock).not.toHaveBeenCalled();
  });

  it('marks run as failed with NO_MODEL_ID when modelId is null', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun({ modelId: null })]);

    await processAiPostTopicGeneration(buildJob());

    expect(generateStructuredObjectMock).not.toHaveBeenCalled();

    const setArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(setArg).toMatchObject({
      status: 'failed',
      errorKind: 'config',
      errorCode: 'NO_MODEL_ID',
    });
  });

  it('completes successfully — persists resultPayload with correct stage sequence', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: VALID_AI_OBJECT,
      durationMs: 2400,
      inputTokens: 300,
      outputTokens: 600,
      providerGenerationId: 'gen_topic_completed_123',
    });

    await processAiPostTopicGeneration(buildJob());

    expect(generateStructuredObjectMock).toHaveBeenCalledOnce();

    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastSetArg).toMatchObject({
      status: 'completed',
      stage: 'completed',
      providerGenerationId: 'gen_topic_completed_123',
    });
    expect(lastSetArg.resultPayload).toBeTruthy();

    // Should have passed through validating status
    expect(
      updateSetMock.mock.calls.some((call) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.status === 'validating';
      })
    ).toBe(true);

    // resultPayload should contain suggestions array
    const payload = lastSetArg.resultPayload as Record<string, unknown>;
    expect(Array.isArray(payload.suggestions)).toBe(true);
  });

  it('uses topic-async as the operation name', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: VALID_AI_OBJECT,
      durationMs: 1000,
      inputTokens: 200,
      outputTokens: 400,
      providerGenerationId: null,
    });

    await processAiPostTopicGeneration(buildJob());

    const callArgs = generateStructuredObjectMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs?.operation).toBe('topic-async');
  });

  it('persists timed_out status and re-throws on AiGenerationError timeout', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('timeout', 'Provider timed out after 30s')
    );

    await expect(processAiPostTopicGeneration(buildJob())).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'timed_out';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg).toBeDefined();
    expect(errorSetArg?.status).toBe('timed_out');
    expect(errorSetArg?.errorKind).toBe('timeout');
  });

  it('re-queues retryable provider failures when another attempt remains', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('provider', 'Upstream 503')
    );

    await expect(processAiPostTopicGeneration(buildJob(RUN_ID, 0, 2))).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const retrySetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'queued';
    })?.[0] as Record<string, unknown> | undefined;

    expect(retrySetArg?.status).toBe('queued');
    expect(retrySetArg?.stage).toBe('queued');
    expect(retrySetArg?.errorKind).toBeNull();
  });

  it('persists failed status after the final provider retry is exhausted', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('provider', 'Upstream 503')
    );

    await expect(processAiPostTopicGeneration(buildJob(RUN_ID, 1, 2))).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.status).toBe('failed');
    expect(errorSetArg?.errorKind).toBe('provider');
  });

  it('fails with validation kind when schema validation rejects the topics output', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    // Only 2 suggestions — below the minimum of 3
    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        suggestions: [
          VALID_SUGGESTION,
          { ...VALID_SUGGESTION, suggestionId: 's2', proposedTitle: 'Segundo tema' },
        ],
      },
      durationMs: 1500,
      inputTokens: 200,
      outputTokens: 400,
      providerGenerationId: 'gen_validation_topic',
    });

    await expect(processAiPostTopicGeneration(buildJob())).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.errorKind).toBe('validation');
  });

  it('uses attemptsMade from job when recording attemptCount', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([]);

    await processAiPostTopicGeneration(buildJob(RUN_ID, 2));

    const claimSetArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(claimSetArg?.attemptCount).toBe(3);
  });

  it('deduplicates suggestions with the same proposedTitle slug', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        suggestions: [
          VALID_SUGGESTION,
          // Same title as the first (duplicate)
          { ...VALID_SUGGESTION, suggestionId: 's2', proposedTitle: 'Filas vs. RPC' },
          { ...VALID_SUGGESTION, suggestionId: 's3', proposedTitle: 'Cache distribuído' },
          { ...VALID_SUGGESTION, suggestionId: 's4', proposedTitle: 'Rate limiting em APIs' },
        ],
      },
      durationMs: 1800,
      inputTokens: 300,
      outputTokens: 500,
      providerGenerationId: null,
    });

    await processAiPostTopicGeneration(buildJob());

    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const payload = lastSetArg.resultPayload as { suggestions: unknown[] };
    // Duplicate should be removed — only 3 unique titles remain
    expect(payload.suggestions.length).toBe(3);
  });
});
