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
import { type Job, UnrecoverableError } from 'bullmq';
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
  aiPostDraftRuns: { id: Symbol('id'), status: Symbol('status') },
  tags: { name: Symbol('name'), slug: Symbol('slug') },
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((field) => ({ field, op: 'asc' })),
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conds) => ({ conds, op: 'and' })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { processAiPostDraftGeneration } from './ai-post-draft-generation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUN_ID = '550e8400-e29b-41d4-a716-446655440000';

function buildJob(runId = RUN_ID, attemptsMade = 0, attempts = 1): Job<{ runId: string }> {
  return {
    id: 'job-test-1',
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
  linkedinPost: 'Novo post sobre filas vs RPC. {{POST_URL}}\n\n#TypeScript #BullMQ #Nodejs',
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
      errorKind: 'config',
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
      providerGenerationId: 'gen_completed_123',
    });

    await processAiPostDraftGeneration(buildJob());

    // No error thrown
    expect(generateStructuredObjectMock).toHaveBeenCalledOnce();

    // Last set call must be the completed state
    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastSetArg).toMatchObject({
      status: 'completed',
      stage: 'completed',
      providerGenerationId: 'gen_completed_123',
    });
    expect(lastSetArg.resultPayload).toBeTruthy();

    expect(
      updateSetMock.mock.calls.some((call) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.status === 'validating';
      })
    ).toBe(true);

    // resultPayload should contain canonicalized tag names
    const payload = lastSetArg.resultPayload as Record<string, unknown>;
    expect(Array.isArray(payload.suggestedTagNames)).toBe(true);
    // linkedinPost: placeholder replaced, canonical URL present
    expect(typeof payload.linkedinPost).toBe('string');
    expect(payload.linkedinPost as string).toContain('https://gustavo-sotero.dev/blog/');
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
      UnrecoverableError
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

  it('re-queues retryable provider failures when another attempt remains', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockRejectedValueOnce(
      new AiGenerationError('provider', 'Upstream 503')
    );

    await expect(processAiPostDraftGeneration(buildJob(RUN_ID, 0, 2))).rejects.toBeInstanceOf(
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

    await expect(processAiPostDraftGeneration(buildJob(RUN_ID, 1, 2))).rejects.toBeInstanceOf(
      UnrecoverableError
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
      providerGenerationId: 'gen_validation_456',
    });

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
      UnrecoverableError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.errorKind).toBe('validation');
    expect(errorSetArg?.providerGenerationId).toBe('gen_validation_456');
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
      UnrecoverableError
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

  it('prefers persisted tag names when canonicalizing result payload tags', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);
    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        orderBy: vi
          .fn()
          .mockResolvedValue([{ name: 'Postgres (custom)', slug: 'postgres-custom' }]),
      })),
    });

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        ...VALID_AI_OBJECT,
        suggestedTagNames: ['postgres-custom'],
      },
      durationMs: 3200,
      inputTokens: 500,
      outputTokens: 800,
    });

    await processAiPostDraftGeneration(buildJob());

    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const payload = lastSetArg.resultPayload as { suggestedTagNames?: string[] };
    expect(payload.suggestedTagNames).toEqual(['Postgres (custom)']);
  });

  it('uses PT-BR fallback imagePrompt when provider returns an empty imagePrompt', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        ...VALID_AI_OBJECT,
        imagePrompt: '   ', // empty after trim
      },
      durationMs: 3000,
      inputTokens: 480,
      outputTokens: 750,
    });

    await processAiPostDraftGeneration(buildJob());

    const lastSetArg = updateSetMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const payload = lastSetArg.resultPayload as { imagePrompt?: string };
    expect(typeof payload.imagePrompt).toBe('string');
    expect(payload.imagePrompt).toMatch(/ilustra[çc][aã]o|minimalista|fundo|escuro/i);
    // Must contain the post title to confirm it came from buildFallbackImagePrompt
    expect(payload.imagePrompt).toContain(VALID_AI_OBJECT.title);
  });

  it('fails with validation kind when linkedinPost is blank', async () => {
    updateWhereMock.mockImplementationOnce(() => ({
      returning: returningMock,
    }));
    returningMock.mockResolvedValueOnce([makeClaimedRun()]);

    generateStructuredObjectMock.mockResolvedValueOnce({
      object: {
        ...VALID_AI_OBJECT,
        linkedinPost: '   ',
      },
      durationMs: 2100,
      inputTokens: 360,
      outputTokens: 540,
    });

    await expect(processAiPostDraftGeneration(buildJob())).rejects.toBeInstanceOf(
      UnrecoverableError
    );

    const errorSetArg = updateSetMock.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'failed';
    })?.[0] as Record<string, unknown> | undefined;

    expect(errorSetArg?.errorKind).toBe('validation');
  });
});
