import { OutboxEventType } from '@portfolio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveActiveAiTopicGenerationConfigMock,
  txInsertRunValuesMock,
  txInsertRunReturningMock,
  txInsertOutboxValuesMock,
  topicRunFindFirstMock,
} = vi.hoisted(() => ({
  resolveActiveAiTopicGenerationConfigMock: vi.fn(),
  txInsertRunValuesMock: vi.fn(),
  txInsertRunReturningMock: vi.fn(),
  txInsertOutboxValuesMock: vi.fn(),
  topicRunFindFirstMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      let insertCallCount = 0;
      const tx = {
        insert: vi.fn(() => {
          insertCallCount += 1;
          return {
            values: insertCallCount === 1 ? txInsertRunValuesMock : txInsertOutboxValuesMock,
          };
        }),
      };

      return callback(tx);
    }),
    query: {
      aiPostTopicRuns: {
        findFirst: topicRunFindFirstMock,
      },
    },
  },
}));

vi.mock('./ai-post-generation-settings.service', () => ({
  resolveActiveAiTopicGenerationConfig: resolveActiveAiTopicGenerationConfigMock,
}));

import { createTopicRun, getTopicRunStatus } from './ai-post-generation-topic-runs.service';

const RUN_ID = '550e8400-e29b-41d4-a716-446655440003';

const BASE_REQUEST = {
  category: 'backend-arquitetura' as const,
  briefing: '  foco em queues em producao  ',
  limit: 4 as const,
  excludedIdeas: ['  tema antigo  ', '  '],
};

const INSERTED_RUN = {
  id: RUN_ID,
  createdAt: new Date('2026-04-15T12:10:00.000Z'),
};

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    status: 'completed',
    stage: 'completed',
    requestedCategory: 'backend-arquitetura',
    modelId: 'openai/gpt-4o-mini',
    attemptCount: 1,
    createdAt: new Date('2026-04-15T12:00:00.000Z'),
    startedAt: new Date('2026-04-15T12:00:05.000Z'),
    finishedAt: new Date('2026-04-15T12:00:20.000Z'),
    errorKind: null,
    errorCode: null,
    errorMessage: null,
    resultPayload: {
      suggestions: [
        {
          suggestionId: 's1',
          category: 'backend-arquitetura',
          proposedTitle: 'Filas vs. RPC',
          angle: 'Trade-offs',
          summary: 'Resumo.',
          targetReader: 'Dev',
          suggestedTagNames: ['BullMQ'],
          rationale: 'Motivo.',
        },
        {
          suggestionId: 's2',
          category: 'backend-arquitetura',
          proposedTitle: 'Outro tema',
          angle: 'Ângulo',
          summary: 'Resumo.',
          targetReader: 'Dev',
          suggestedTagNames: ['Redis'],
          rationale: 'Motivo.',
        },
        {
          suggestionId: 's3',
          category: 'backend-arquitetura',
          proposedTitle: 'Terceiro tema',
          angle: 'Ângulo 3',
          summary: 'Resumo 3.',
          targetReader: 'Dev',
          suggestedTagNames: ['TypeScript'],
          rationale: 'Motivo 3.',
        },
      ],
    },
    ...overrides,
  };
}

describe('ai-post-generation-topic-runs.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActiveAiTopicGenerationConfigMock.mockResolvedValue({
      topicsModelId: 'openai/gpt-4o-mini',
    });
    txInsertRunValuesMock.mockReturnValue({ returning: txInsertRunReturningMock });
    txInsertRunReturningMock.mockResolvedValue([INSERTED_RUN]);
    txInsertOutboxValuesMock.mockResolvedValue(undefined);
    topicRunFindFirstMock.mockResolvedValue(null);
  });

  it('normalizes the request payload before persisting the topic run', async () => {
    const response = await createTopicRun(BASE_REQUEST, 'admin-github-id');

    expect(response).toEqual({
      runId: RUN_ID,
      status: 'queued',
      stage: 'queued',
      pollAfterMs: 1000,
      createdAt: INSERTED_RUN.createdAt.toISOString(),
    });

    const insertedValues = txInsertRunValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues.requestedCategory).toBe('backend-arquitetura');
    expect(insertedValues.modelId).toBe('openai/gpt-4o-mini');
    expect(insertedValues.createdBy).toBe('admin-github-id');
    expect(insertedValues.status).toBe('queued');
    expect(insertedValues.stage).toBe('queued');

    // Briefing whitespace trimmed, empty excluded ideas filtered
    const payload = insertedValues.requestPayload as Record<string, unknown>;
    expect(payload.briefing).toBe('foco em queues em producao');
    expect(payload.excludedIdeas).toEqual(['tema antigo']);

    expect(txInsertOutboxValuesMock).toHaveBeenCalledWith({
      eventType: OutboxEventType.AI_POST_TOPIC_RUN_REQUESTED,
      payload: { runId: RUN_ID },
      status: 'pending',
    });
  });

  it('returns null when run does not exist', async () => {
    topicRunFindFirstMock.mockResolvedValueOnce(null);

    const result = await getTopicRunStatus('non-existent-id');
    expect(result).toBeNull();
  });

  it('returns the formatted status for a queued run', async () => {
    topicRunFindFirstMock.mockResolvedValueOnce(
      makeRun({
        status: 'queued',
        stage: 'queued',
        startedAt: null,
        finishedAt: null,
        resultPayload: null,
      })
    );

    const status = await getTopicRunStatus(RUN_ID);

    expect(status?.status).toBe('queued');
    expect(status?.stage).toBe('queued');
    expect(status?.durationMs).toBeNull();
    expect(status?.result).toBeNull();
    expect(status?.error).toBeNull();
  });

  it('returns the validated result for completed runs', async () => {
    topicRunFindFirstMock.mockResolvedValueOnce(makeRun());

    const status = await getTopicRunStatus(RUN_ID);

    expect(status?.status).toBe('completed');
    expect(status?.durationMs).toBe(15000);
    expect(status?.result?.suggestions).toHaveLength(3);
    expect(status?.result?.suggestions[0]?.proposedTitle).toBe('Filas vs. RPC');
  });

  it('returns null result for runs with invalid/legacy resultPayload', async () => {
    topicRunFindFirstMock.mockResolvedValueOnce(
      makeRun({ resultPayload: { suggestions: [{ invalid: true }] } })
    );

    const status = await getTopicRunStatus(RUN_ID);

    expect(status?.status).toBe('completed');
    expect(status?.result).toBeNull();
  });

  it('returns error details for failed runs', async () => {
    topicRunFindFirstMock.mockResolvedValueOnce(
      makeRun({
        status: 'failed',
        stage: 'requesting-provider',
        finishedAt: new Date('2026-04-15T12:00:35.000Z'),
        resultPayload: null,
        errorKind: 'provider',
        errorCode: null,
        errorMessage: 'Upstream 503',
      })
    );

    const status = await getTopicRunStatus(RUN_ID);

    expect(status?.status).toBe('failed');
    expect(status?.error?.kind).toBe('provider');
    expect(status?.error?.message).toBe('Upstream 503');
    expect(status?.result).toBeNull();
  });

  it('throws when config resolution fails (pre-flight guard)', async () => {
    resolveActiveAiTopicGenerationConfigMock.mockRejectedValueOnce(
      new Error('Topics model not configured')
    );

    await expect(createTopicRun(BASE_REQUEST, 'admin-github-id')).rejects.toThrow(
      'Topics model not configured'
    );

    // No DB insert should happen
    expect(txInsertRunValuesMock).not.toHaveBeenCalled();
  });
});
