import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  selectLimitMock,
  updateSetMock,
  updateWhereMock,
  dbSelectMock,
  dbUpdateMock,
  bytesMock,
  writeMock,
  metadataMock,
  resizeMock,
  webpMock,
  toBufferMock,
  gifMock,
} = vi.hoisted(() => ({
  selectLimitMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  bytesMock: vi.fn(),
  writeMock: vi.fn(),
  metadataMock: vi.fn(),
  resizeMock: vi.fn(),
  webpMock: vi.fn(),
  gifMock: vi.fn(),
  toBufferMock: vi.fn(),
}));

dbSelectMock.mockImplementation(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: selectLimitMock,
    })),
  })),
}));

dbUpdateMock.mockImplementation(() => ({
  set: updateSetMock,
}));

updateSetMock.mockImplementation(() => ({
  where: updateWhereMock,
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: dbUpdateMock,
  },
}));

vi.mock('../config/s3', () => ({
  s3: {
    file: vi.fn(() => ({
      bytes: bytesMock,
      write: writeMock,
    })),
  },
  getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  uploads: {
    id: Symbol('id'),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => Symbol('eq')),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: metadataMock,
    resize: resizeMock,
  })),
}));

resizeMock.mockImplementation(() => ({
  webp: webpMock,
  gif: gifMock,
}));

webpMock.mockImplementation(() => ({
  toBuffer: toBufferMock,
}));

gifMock.mockImplementation(() => ({
  toBuffer: toBufferMock,
}));

import { processImageOptimize } from './imageOptimize';

function buildJob(
  data: { uploadId: string },
  options?: { attemptsMade?: number; attempts?: number }
): Job<{ uploadId: string }> {
  return {
    id: 'job-1',
    attemptsMade: options?.attemptsMade ?? 0,
    opts: {
      attempts: options?.attempts ?? 3,
    },
    data,
  } as Job<{ uploadId: string }>;
}

describe('imageOptimize job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSetMock.mockImplementation(() => ({
      where: updateWhereMock,
    }));
    resizeMock.mockImplementation(() => ({ webp: webpMock, gif: gifMock }));
    webpMock.mockImplementation(() => ({ toBuffer: toBufferMock }));
    gifMock.mockImplementation(() => ({ toBuffer: toBufferMock }));
    updateWhereMock.mockResolvedValue(undefined);
  });

  it('processes image and updates upload as processed with variants', async () => {
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-1',
        storageKey: 'uploads/2026/02/original.png',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/original.png',
        mime: 'image/png',
      },
    ]);
    bytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    metadataMock.mockResolvedValue({ width: 1200, height: 800, pages: 1 });
    toBufferMock
      .mockResolvedValueOnce(Buffer.from('thumb'))
      .mockResolvedValueOnce(Buffer.from('medium'));

    await processImageOptimize(buildJob({ uploadId: 'upload-1' }));

    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processed',
        width: 1200,
        height: 800,
        optimizedUrl: expect.stringContaining('_medium.webp'),
        variants: expect.objectContaining({
          thumbnail: expect.stringContaining('_thumb.webp'),
          medium: expect.stringContaining('_medium.webp'),
        }),
      })
    );
  });

  it('marks upload as failed only when the final attempt throws', async () => {
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-2',
        storageKey: 'uploads/2026/02/original.png',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/original.png',
        mime: 'image/png',
      },
    ]);
    bytesMock.mockRejectedValue(new Error('storage failure'));

    await expect(
      processImageOptimize(buildJob({ uploadId: 'upload-2' }, { attemptsMade: 2, attempts: 3 }))
    ).rejects.toThrow('storage failure');

    expect(updateSetMock).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('does not mark upload as failed on non-final retryable attempts', async () => {
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-retry-1',
        storageKey: 'uploads/2026/02/original.png',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/original.png',
        mime: 'image/png',
      },
    ]);
    bytesMock.mockRejectedValue(new Error('temporary failure'));

    await expect(
      processImageOptimize(
        buildJob({ uploadId: 'upload-retry-1' }, { attemptsMade: 0, attempts: 3 })
      )
    ).rejects.toThrow('temporary failure');

    expect(updateSetMock).not.toHaveBeenCalledWith({ status: 'failed' });
  });

  it('generates GIF thumbnail and medium variants for animated GIF uploads', async () => {
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-gif-1',
        storageKey: 'uploads/2026/02/original.gif',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/original.gif',
        mime: 'image/gif',
      },
    ]);
    bytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    metadataMock.mockResolvedValue({ width: 900, height: 500, pages: 4 });
    toBufferMock.mockResolvedValue(Buffer.from('gif-variant'));

    await processImageOptimize(buildJob({ uploadId: 'upload-gif-1' }));

    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processed',
        optimizedUrl: expect.stringContaining('_medium.gif'),
        variants: expect.objectContaining({
          thumbnail: expect.stringContaining('_thumb.gif'),
          medium: expect.stringContaining('_medium.gif'),
        }),
      })
    );
  });

  it('marks upload as failed when storageKey is missing (contract violation)', async () => {
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-missing-key-1',
        storageKey: null,
        originalUrl: 'https://cdn.example.com/bucket-only',
        mime: 'image/png',
      },
    ]);

    await expect(
      processImageOptimize(
        buildJob({ uploadId: 'upload-missing-key-1' }, { attemptsMade: 2, attempts: 3 })
      )
    ).rejects.toThrow('missing storageKey');

    expect(updateSetMock).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('uses storageKey directly for S3 download when record has storageKey', async () => {
    const { s3 } = await import('../config/s3');
    selectLimitMock.mockResolvedValue([
      {
        id: 'upload-with-key',
        storageKey: 'uploads/2026/02/canonical-key.png',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/canonical-key.png',
        mime: 'image/png',
      },
    ]);
    bytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    metadataMock.mockResolvedValue({ width: 800, height: 600, pages: 1 });
    toBufferMock
      .mockResolvedValueOnce(Buffer.from('thumb'))
      .mockResolvedValueOnce(Buffer.from('medium'));

    await processImageOptimize(buildJob({ uploadId: 'upload-with-key' }));

    // First s3.file() call must use the canonical storageKey
    expect(s3.file).toHaveBeenCalledWith('uploads/2026/02/canonical-key.png');
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });
});
