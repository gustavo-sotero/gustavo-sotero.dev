import { describe, expect, it, vi } from 'vitest';
import { runCommentRenderedContentBackfill } from './backfill-comment-rendered-content';

interface CommentRow {
  id: string;
  content: string;
  renderedContent: string | null;
}

function createDbClient(rowsByOffset: Record<number, CommentRow[]>) {
  const updateWhereMock = vi.fn().mockResolvedValue(undefined);
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));
  const offsetMock = vi.fn((offset: number) => Promise.resolve(rowsByOffset[offset] ?? []));
  const limitMock = vi.fn(() => ({ offset: offsetMock }));
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  return {
    client: {
      select: selectMock,
      update: updateMock,
    },
    mocks: {
      selectMock,
      fromMock,
      orderByMock,
      limitMock,
      offsetMock,
      updateMock,
      updateSetMock,
      updateWhereMock,
    },
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe('runCommentRenderedContentBackfill', () => {
  it('re-renders legacy rows in batches and updates only changed comments', async () => {
    const rowsByOffset = {
      0: [
        { id: 'c1', content: 'legacy-one', renderedContent: null },
        { id: 'c2', content: 'already-ok', renderedContent: '<p>already-ok</p>' },
      ],
      2: [{ id: 'c3', content: 'legacy-two', renderedContent: '<p>stale</p>' }],
      3: [],
    } satisfies Record<number, CommentRow[]>;
    const { client, mocks } = createDbClient(rowsByOffset);
    const logger = createLogger();
    const renderComment = vi.fn(async (content: string) => `<p>${content}</p>`);

    await runCommentRenderedContentBackfill({
      dbClient: client as never,
      renderComment,
      loggerInstance: logger as never,
      batchSize: 2,
    });

    expect(renderComment).toHaveBeenCalledTimes(3);
    expect(mocks.updateSetMock).toHaveBeenCalledTimes(2);
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(1, {
      renderedContent: '<p>legacy-one</p>',
    });
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(2, {
      renderedContent: '<p>legacy-two</p>',
    });
    expect(logger.info).toHaveBeenCalledWith('Comment rendered-content backfill completed', {
      scanned: 3,
      updated: 2,
      failed: 0,
    });
  });

  it('surfaces failed legacy rows explicitly instead of silently skipping them', async () => {
    const rowsByOffset = {
      0: [
        { id: 'c1', content: 'ok', renderedContent: null },
        { id: 'c2', content: 'broken', renderedContent: null },
      ],
      2: [],
    } satisfies Record<number, CommentRow[]>;
    const { client, mocks } = createDbClient(rowsByOffset);
    const logger = createLogger();
    const renderComment = vi.fn(async (content: string) => {
      if (content === 'broken') {
        throw new Error('markdown parse failed');
      }

      return `<p>${content}</p>`;
    });

    await expect(
      runCommentRenderedContentBackfill({
        dbClient: client as never,
        renderComment,
        loggerInstance: logger as never,
        batchSize: 2,
      })
    ).rejects.toThrow('Backfill completed with 1 failed row(s)');

    expect(mocks.updateSetMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Failed to backfill rendered content for comment', {
      commentId: 'c2',
      error: 'markdown parse failed',
    });
    expect(logger.info).toHaveBeenCalledWith('Comment rendered-content backfill completed', {
      scanned: 2,
      updated: 1,
      failed: 1,
    });
  });
});
