import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveActiveAiDraftGenerationConfigMock,
  selectOrderByMock,
  txInsertRunValuesMock,
  txInsertRunReturningMock,
  txInsertOutboxValuesMock,
  draftRunFindFirstMock,
} = vi.hoisted(() => ({
  resolveActiveAiDraftGenerationConfigMock: vi.fn(),
  selectOrderByMock: vi.fn(),
  txInsertRunValuesMock: vi.fn(),
  txInsertRunReturningMock: vi.fn(),
  txInsertOutboxValuesMock: vi.fn(),
  draftRunFindFirstMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: selectOrderByMock,
      })),
    })),
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
      aiPostDraftRuns: {
        findFirst: draftRunFindFirstMock,
      },
    },
  },
}));

vi.mock('./ai-post-generation-settings.service', () => ({
  resolveActiveAiDraftGenerationConfig: resolveActiveAiDraftGenerationConfigMock,
}));

import { createDraftRun, getDraftRunStatus } from './ai-post-generation-draft-runs.service';

const RUN_ID = '550e8400-e29b-41d4-a716-446655440000';

const BASE_REQUEST = {
  category: 'backend-arquitetura' as const,
  briefing: '  comparativo pratico sobre filas  ',
  selectedSuggestion: {
    suggestionId: 'topic-1',
    category: 'backend-arquitetura' as const,
    proposedTitle: '  Fila nao e arquitetura  ',
    angle: '  Quando usar e quando evitar  ',
    summary: '  Compara custos operacionais.  ',
    targetReader: '  Dev backend pleno  ',
    suggestedTagNames: [' typescript ', 'Bullmq', 'nodejs', 'BullMQ'],
    rationale: '  Tema recorrente em sistemas distribuidos.  ',
  },
  rejectedAngles: ['  muito generico  ', '   ', '  sem tradeoff  '],
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
    concreteCategory: 'backend-arquitetura',
    modelId: 'openai/gpt-4o',
    attemptCount: 1,
    createdAt: new Date('2026-04-15T12:00:00.000Z'),
    startedAt: new Date('2026-04-15T12:00:05.000Z'),
    finishedAt: new Date('2026-04-15T12:00:20.000Z'),
    errorKind: null,
    errorCode: null,
    errorMessage: null,
    resultPayload: {
      title: 'Fila nao e arquitetura',
      slug: 'fila-nao-e-arquitetura',
      excerpt: 'Resumo curto.',
      content:
        '## Intro\n\nConteudo suficientemente longo para satisfazer a validacao minima do draft gerado no polling assíncrono.',
      suggestedTagNames: ['TypeScript', 'BullMQ', 'Node.js'],
      imagePrompt:
        'Ilustracao simples, minimalista e elegante em fundo escuro representando filas assincronas, composicao para thumb em formato 1:1.',
      linkedinPost:
        'Novo post: https://gustavo-sotero.dev/blog/fila-nao-e-arquitetura\n\n#TypeScript #BullMQ #Nodejs',
      notes: null,
    },
    ...overrides,
  };
}

describe('ai-post-generation-draft-runs.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActiveAiDraftGenerationConfigMock.mockResolvedValue({
      draftModelId: 'openai/gpt-4o',
    });
    selectOrderByMock.mockResolvedValue([
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'BullMQ', slug: 'bullmq' },
    ]);
    txInsertRunValuesMock.mockReturnValue({ returning: txInsertRunReturningMock });
    txInsertRunReturningMock.mockResolvedValue([INSERTED_RUN]);
    txInsertOutboxValuesMock.mockResolvedValue(undefined);
    draftRunFindFirstMock.mockResolvedValue(null);
  });

  it('normalizes the request payload before persisting the draft run', async () => {
    const response = await createDraftRun(BASE_REQUEST, 'admin-github-id');

    expect(response).toEqual({
      runId: RUN_ID,
      status: 'queued',
      stage: 'queued',
      pollAfterMs: 1000,
      createdAt: INSERTED_RUN.createdAt.toISOString(),
    });

    const insertedValues = txInsertRunValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues.requestedCategory).toBe('backend-arquitetura');
    expect(insertedValues.concreteCategory).toBe('backend-arquitetura');
    expect(insertedValues.modelId).toBe('openai/gpt-4o');
    expect(insertedValues.createdBy).toBe('admin-github-id');
    expect(insertedValues.requestPayload).toEqual({
      category: 'backend-arquitetura',
      briefing: 'comparativo pratico sobre filas',
      selectedSuggestion: {
        suggestionId: 'topic-1',
        category: 'backend-arquitetura',
        proposedTitle: 'Fila nao e arquitetura',
        angle: 'Quando usar e quando evitar',
        summary: 'Compara custos operacionais.',
        targetReader: 'Dev backend pleno',
        suggestedTagNames: ['TypeScript', 'BullMQ', 'Node.js'],
        rationale: 'Tema recorrente em sistemas distribuidos.',
      },
      rejectedAngles: ['muito generico', 'sem tradeoff'],
    });

    expect(txInsertOutboxValuesMock).toHaveBeenCalledWith({
      eventType: OutboxEventType.AI_POST_DRAFT_GENERATE_REQUESTED,
      payload: { runId: RUN_ID },
      status: 'pending',
    });
  });

  it('returns null result for historical completed runs with legacy payload shape', async () => {
    draftRunFindFirstMock.mockResolvedValueOnce(
      makeRun({
        resultPayload: {
          title: 'Fila nao e arquitetura',
          slug: 'fila-nao-e-arquitetura',
          excerpt: 'Resumo curto.',
          content:
            '## Intro\n\nConteudo suficientemente longo para satisfazer a validacao minima mesmo sem linkedinPost.',
          suggestedTagNames: ['TypeScript', 'BullMQ'],
          imagePrompt: 'Ilustracao minimalista em PT-BR',
          notes: null,
        },
      })
    );

    const status = await getDraftRunStatus(RUN_ID);

    expect(status?.status).toBe('completed');
    expect(status?.selectedSuggestionCategory).toBe('backend-arquitetura');
    expect(status?.concreteCategory).toBe('backend-arquitetura');
    expect(status?.result).toBeNull();
  });

  it('returns the validated result for completed runs with the current schema', async () => {
    draftRunFindFirstMock.mockResolvedValueOnce(makeRun());

    const status = await getDraftRunStatus(RUN_ID);

    expect(status?.status).toBe('completed');
    expect(status?.durationMs).toBe(15000);
    expect(status?.result?.linkedinPost).toContain(
      'https://gustavo-sotero.dev/blog/fila-nao-e-arquitetura'
    );
    expect(status?.result?.suggestedTagNames).toEqual(['TypeScript', 'BullMQ', 'Node.js']);
  });
});
