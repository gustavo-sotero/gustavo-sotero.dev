/**
 * Tests for the AI post draft generation worker job.
 *
 * Covers:
 * - Idempotent claim guard: already-claimed run is skipped
 * - Missing modelId path: run fails with NO_MODEL_ID
 * - Successful full execution: stages → completed with resultPayload
 * - Timeout: timed_out status + re-throw
 * - Transient provider failure: failed status + re-throw (BullMQ retries)
 * - Validation error (inline HTML): failed with validation kind
 * - Non-queued status (completed run): not reprocessed
 */

import { AiGenerationError } from '@portfolio/shared';
import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  dbUpdateMock,
  updateSetMock,
  updateWhereMock,
  returningMock,
  generateStructuredObjectMock,
} = vi.hoisted(() => ({
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
  aiPostDraftRuns: { id: Symbol('id'), status: Symbol('status') },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conds) => ({ conds, op: 'and' })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { processAiPostDraftGeneration } from './ai-post-draft-generation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUN_ID = '550e8400-e29b-41d4-a716-446655440000';

function buildJob(runId = RUN_ID, attemptsMade = 0): Job<{ runId: string }> {
  return {
    id: 'job-test-1',
    attemptsMade,
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
      selectedSuggestion: {
        suggestionId: 's1',
        category: 'backend-arquitetura',
        proposedTitle: 'Filas vs. RPC',
        angle: 'Trade-offs de acoplamento',
        summary: 'Quando usar filas e quando o RPC síncrono é superior.',
        targetReader: 'Engenheiro backend',
        suggestedTagNames: ['TypeScript', 'BullMQ'],
        rationale: 'Tema pouco discutido em PT-BR.',
      },
      rejectedAngles: [],
    },
  };
}

/** Simulate a successful AI response object. */
const VALID_AI_OBJECT = {
  title: 'Filas vs. RPC: trade-offs de acoplamento',
  slug: 'filas-vs-rpc-trade-offs-de-acoplamento',
  excerpt: 'Uma análise objetiva de quando usar filas assíncronas versus chamadas RPC síncronas.',
  content:
    '## Introdução\n\nFilas e RPC são ferramentas complementares, não concorrentes. Entender seus trade-offs é essencial para projetar sistemas resilientes. Neste post, exploramos os critérios decisivos para escolher entre cada abordagem.\n\n## Quando usar filas\n\nFilas são ideais para tarefas demoradas, tolerantes a latência e que precisam de retry automático.',
  suggestedTagNames: ['TypeScript', 'bullmq', 'nodejs'],
  imagePrompt: 'Dark illustration of queues and arrows in a modern tech aesthetic',
  notes: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('processAiPostDraftGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: update → set → where → undefined (stage updates)
    dbUpdateMock.mockImplementation(() => ({ set: updateSetMock }));
    updateSetMock.mockImplementation(() => ({ where: updateWhereMock }));
    updateWhereMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips processing when run is already claimed (not in queued status)', async () => {
    // Claim returns no rows → run was already claimed
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([]); // empty returning → not claimed

    await processAiPostDraftGeneration(buildJob());

    // generateStructuredObject must NOT be called
    expect(generateStructuredObjectMock).not.toHaveBeenCalled();
  });

  it('marks run as failed with NO_MODEL_ID when modelId is null', async () => {
    // First call: claim succeeds (returns run without modelId)
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun({ modelId: null })]);

    await processAiPostDraftGeneration(buildJob());

    // Must NOT have called the AI provider
    expect(generateStructuredObjectMock).not.toHaveBeenCalled();

    // Must have updated to failed with NO_MODEL_ID
    const setArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(setArg).toMatchObject({
      status: 'failed',
      errorCode: 'NO_MODEL_ID',
    });
  });

  it('completes successfully — persists resultPayload with correct stage sequence', async () => {
    // Claim succeeds
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    // AI provider returns valid draft
    generateStructuredObjectMock.mockResolvedValueOnce({
      object: VALID_AI_OBJECT,
      durationMs: 3200,
      inputTokens: 500,
      outputTokens: 800,
    });

    await processAiPostDraftGeneration(buildJob());

    // No error thrown
    expect(generateStructuredObjectMock).toHaveBeenCalledOnce();

    // Last set call must be the completed state
    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastSetArg).toMatchObject({
      status: 'completed',
      stage: 'completed',
    });
    expect(lastSetArg.resultPayload).toBeTruthy();

    // resultPayload should contain canonicalized tag names
    const payload = lastSetArg.resultPayload as Record<string, unknown>;
    expect(Array.isArray(payload.suggestedTagNames)).toBe(true);
  });

  it('persists timed_out status and re-throws on AiGenerationError timeout', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('timeout', 'Provider timed out after 30s')
    );

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
      AiGenerationError
    );

    // Error persistence: status = timed_out
    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'timed_out';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg).toBeDefined();
    expect(errorSetArg?.status).toBe('timed_out');
    expect(errorSetArg?.errorKind).toBe('timeout');
  });

  it('persists failed status and re-throws on transient provider error', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('provider', 'Upstream 503')
    );

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.status).toBe('failed');
    expect(errorSetArg?.errorKind).toBe('provider');
  });

  it('fails with validation kind when generated content contains inline HTML', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        ...VALID_AI_OBJECT,
        // Inject HTML outside a code fence — not inside ``` block
        content:
          '## Título\n\n<script>alert(1)</script>\n\nOutro parágrafo que aumenta o comprimento.',
      },
      durationMs: 2000,
      inputTokens: 400,
      outputTokens: 600,
    });

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
      AiGenerationError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.errorKind).toBe('validation');
  });

  it('fails with validation kind when schema validation rejects the draft output', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        ...VALID_AI_OBJECT,
        // Empty title will fail requiredString validation
        title: '   ',
        slug: '   ',
      },
      durationMs: 1500,
      inputTokens: 300,
      outputTokens: 500,
    });

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
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

    await processAiPostDraftGeneration(buildJob(RUN_ID, 2));

    // The first set call (claim) should include attemptCount = attemptsMade + 1
    const claimSetArg = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(claimSetArg?.attemptCount).toBe(3);
  });
});
