/**
 * Tests for the post-publish job handler.
 *
 * Covers:
 *  - Publishes a scheduled post at the designated time
 *  - Idempotent: already-published post → no-op
 *  - Deleted post → no-op (skip silently)
 *  - Not-found post → no-op (skip silently)
 *  - Status changed to non-scheduled → no-op
 *  - scheduledAt still in future → throws (triggers retry)
 *  - CAS update returns 0 rows → no-op (concurrent handling)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbSelectMock, dbUpdateMock, selectFromMock, selectWhereMock, selectLimitMock } = vi.hoisted(
  () => ({
    dbSelectMock: vi.fn(),
    dbUpdateMock: vi.fn(),
    selectFromMock: vi.fn(),
    selectWhereMock: vi.fn(),
    selectLimitMock: vi.fn(),
  })
);

const { andMock, eqMock, isNullMock, lteMock, sqlMock, postsTable } = vi.hoisted(() => ({
  andMock: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  eqMock: vi.fn(() => ({ _op: 'eq' })),
  isNullMock: vi.fn(() => ({ _op: 'isNull' })),
  lteMock: vi.fn(() => ({ _op: 'lte' })),
  sqlMock: vi.fn(() => ({ _op: 'sql' })),
  postsTable: {
    id: 'posts.id',
    slug: 'posts.slug',
    status: 'posts.status',
    scheduledAt: 'posts.scheduledAt',
    deletedAt: 'posts.deletedAt',
    publishedAt: 'posts.publishedAt',
    updatedAt: 'posts.updatedAt',
  },
}));

const { invalidatePatternMock } = vi.hoisted(() => ({
  invalidatePatternMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: dbUpdateMock,
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('drizzle-orm', () => ({
  and: andMock,
  eq: eqMock,
  isNull: isNullMock,
  lte: lteMock,
  sql: sqlMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  posts: postsTable,
}));

vi.mock('../lib/cache', () => ({
  invalidatePattern: invalidatePatternMock,
}));

import type { Job } from 'bullmq';
import { type PostPublishJobData, processPostPublish } from './postPublish';

function makeJob(postId: number): Job<PostPublishJobData> {
  return {
    id: 'test-job-1',
    data: { postId },
    attemptsMade: 0,
  } as unknown as Job<PostPublishJobData>;
}

/** Set up db.select to return a given row (or empty). */
function mockDbSelect(row: object | null) {
  selectLimitMock.mockResolvedValueOnce(row ? [row] : []);
  selectWhereMock.mockReturnValue({ limit: selectLimitMock });
  selectFromMock.mockReturnValue({ where: selectWhereMock });
  dbSelectMock.mockReturnValue({ from: selectFromMock });
}

/** Set up db.update().set().where().returning() chain. */
function mockDbUpdate(updatedRow: object | null) {
  const returningMock = vi.fn().mockResolvedValueOnce(updatedRow ? [updatedRow] : []);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  dbUpdateMock.mockReturnValue({ set: setMock });
  return { setMock, whereMock, returningMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processPostPublish', () => {
  it('publica o post agendado com sucesso (caminho feliz)', async () => {
    const scheduledAt = new Date(Date.now() - 1000); // passado
    mockDbSelect({
      id: 1,
      slug: 'meu-post',
      status: 'scheduled',
      scheduledAt,
      deletedAt: null,
      publishedAt: null,
    });
    const { setMock } = mockDbUpdate({ id: 1, slug: 'meu-post' });

    await processPostPublish(makeJob(1));

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
        scheduledAt: null,
      })
    );
    expect(invalidatePatternMock).toHaveBeenCalledTimes(4);
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
  });

  it('sai sem erro se o post não for encontrado', async () => {
    mockDbSelect(null);

    await expect(processPostPublish(makeJob(99))).resolves.toBeUndefined();
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('sai sem erro se o post foi deletado', async () => {
    mockDbSelect({
      id: 2,
      slug: 'post-b',
      status: 'scheduled',
      scheduledAt: new Date(),
      deletedAt: new Date(),
      publishedAt: null,
    });

    await expect(processPostPublish(makeJob(2))).resolves.toBeUndefined();
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('e idempotente: sai sem erro se já está publicado', async () => {
    mockDbSelect({
      id: 3,
      slug: 'post-c',
      status: 'published',
      scheduledAt: null,
      deletedAt: null,
      publishedAt: new Date(),
    });

    await expect(processPostPublish(makeJob(3))).resolves.toBeUndefined();
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('sai sem erro se status mudou para draft antes do job executar', async () => {
    mockDbSelect({
      id: 4,
      slug: 'post-d',
      status: 'draft',
      scheduledAt: null,
      deletedAt: null,
      publishedAt: null,
    });

    await expect(processPostPublish(makeJob(4))).resolves.toBeUndefined();
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('lança erro se scheduledAt ainda está no futuro (aciona retry)', async () => {
    const futureScheduledAt = new Date(Date.now() + 10_000);
    mockDbSelect({
      id: 5,
      slug: 'post-e',
      status: 'scheduled',
      scheduledAt: futureScheduledAt,
      deletedAt: null,
      publishedAt: null,
    });

    await expect(processPostPublish(makeJob(5))).rejects.toThrow(/still in the future/);
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('não falha se CAS update retorna 0 linhas (concorrência)', async () => {
    const scheduledAt = new Date(Date.now() - 500);
    mockDbSelect({
      id: 6,
      slug: 'post-f',
      status: 'scheduled',
      scheduledAt,
      deletedAt: null,
      publishedAt: null,
    });
    mockDbUpdate(null); // 0 rows returned — concurrent handler processed it

    await expect(processPostPublish(makeJob(6))).resolves.toBeUndefined();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });
});
