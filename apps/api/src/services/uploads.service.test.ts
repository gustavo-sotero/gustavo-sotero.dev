import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { MAX_UPLOAD_BYTES } from '@portfolio/shared/constants/uploads';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, DomainValidationError, NotFoundError } from '../lib/errors';

const {
  presignMock,
  statMock,
  sliceMock,
  arrayBufferMock,
  createUploadMock,
  findUploadByIdMock,
  updateUploadMock,
  enqueueImageOptimizeMock,
  txInsertValuesMock,
  txUpdateReturningMock,
}: {
  presignMock: ReturnType<typeof vi.fn>;
  statMock: ReturnType<typeof vi.fn>;
  sliceMock: ReturnType<typeof vi.fn>;
  arrayBufferMock: ReturnType<typeof vi.fn>;
  createUploadMock: ReturnType<typeof vi.fn>;
  findUploadByIdMock: ReturnType<typeof vi.fn>;
  updateUploadMock: ReturnType<typeof vi.fn>;
  enqueueImageOptimizeMock: ReturnType<typeof vi.fn>;
  txInsertValuesMock: ReturnType<typeof vi.fn>;
  txUpdateReturningMock: ReturnType<typeof vi.fn>;
} = vi.hoisted(() => ({
  presignMock: vi.fn(),
  statMock: vi.fn(),
  sliceMock: vi.fn(),
  arrayBufferMock: vi.fn(),
  createUploadMock: vi.fn(),
  findUploadByIdMock: vi.fn(),
  updateUploadMock: vi.fn(),
  enqueueImageOptimizeMock: vi.fn(),
  txInsertValuesMock: vi.fn(),
  txUpdateReturningMock: vi.fn(),
}));

vi.mock('../config/s3', () => ({
  s3: {
    file: vi.fn(() => ({
      presign: presignMock,
      stat: statMock,
      slice: sliceMock,
    })),
  },
  getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
}));

// confirmUpload now uses db.transaction internally (H-SEC-02: atomic outbox pattern);
// the tx mock controls what the status-update returning() resolves to.
vi.mock('../config/db', () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: txUpdateReturningMock,
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: txInsertValuesMock,
        })),
      };
      return cb(tx);
    }),
  },
}));

vi.mock('../repositories/uploads.repo', () => ({
  createUpload: createUploadMock,
  findUploadById: findUploadByIdMock,
  updateUpload: updateUploadMock,
}));

vi.mock('../lib/queues', () => ({
  enqueueImageOptimize: enqueueImageOptimizeMock,
}));

import { confirmUpload, generatePresignedUrl, getUploadById } from './uploads.service';

function makeArrayBuffer(bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe('uploads service', () => {
  beforeEach(() => {
    presignMock.mockReset();
    statMock.mockReset();
    sliceMock.mockReset();
    arrayBufferMock.mockReset();
    createUploadMock.mockReset();
    findUploadByIdMock.mockReset();
    updateUploadMock.mockReset();
    enqueueImageOptimizeMock.mockReset();
    txInsertValuesMock.mockReset();
    txUpdateReturningMock.mockReset();

    presignMock.mockReturnValue('https://presigned.example.com/put');
    statMock.mockResolvedValue({ size: 1024, type: 'image/jpeg' });
    arrayBufferMock.mockResolvedValue(
      makeArrayBuffer([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    );
    sliceMock.mockReturnValue({ arrayBuffer: arrayBufferMock });
    createUploadMock.mockResolvedValue({ id: 'upload-1' });
    updateUploadMock.mockResolvedValue({
      id: 'upload-1',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      optimizedUrl: null,
      variants: { thumbnail: 'https://cdn.example.com/uploads/2026/02/file-thumb.webp' },
      mime: 'image/jpeg',
      size: 1024,
      width: null,
      height: null,
      status: 'uploaded',
      createdAt: new Date(),
    });
    enqueueImageOptimizeMock.mockResolvedValue(undefined);
    txInsertValuesMock.mockResolvedValue(undefined);
    // Default: transaction update succeeds and returns the uploaded row
    txUpdateReturningMock.mockResolvedValue([
      {
        id: 'upload-1',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
        optimizedUrl: null,
        variants: { thumbnail: 'https://cdn.example.com/uploads/2026/02/file-thumb.webp' },
        mime: 'image/jpeg',
        size: 1024,
        width: null,
        height: null,
        status: 'uploaded',
        createdAt: new Date(),
      },
    ]);
  });

  it('generatePresignedUrl creates pending upload and returns key/url/id', async () => {
    const result = await generatePresignedUrl({
      mime: 'image/jpeg',
      size: 1024,
      filename: 'photo.jpg',
    });

    expect(result.uploadId).toBe('upload-1');
    expect(result.presignedUrl).toBe('https://presigned.example.com/put');
    expect(result.key).toMatch(/^uploads\/\d{4}\/\d{2}\/.+\.jpg$/);

    expect(createUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: 'image/jpeg',
        size: 1024,
        status: 'pending',
        originalUrl: expect.stringContaining('/uploads/'),
        storageKey: expect.stringMatching(/^uploads\/\d{4}\/\d{2}\/.+\.jpg$/),
      })
    );
  });

  it('generatePresignedUrl persists storageKey matching the returned key', async () => {
    const result = await generatePresignedUrl({
      mime: 'image/png',
      size: 512,
      filename: 'screenshot.png',
    });

    const [callArgs] = createUploadMock.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs.storageKey).toBe(result.key);
    expect(result.key).toMatch(/^uploads\/\d{4}\/\d{2}\/.+\.png$/);
  });

  it('generatePresignedUrl rejects unsupported mime defensively', async () => {
    await expect(
      generatePresignedUrl({ mime: 'application/pdf', size: 100, filename: 'x.pdf' })
    ).rejects.toThrow(DomainValidationError);
  });

  it('generatePresignedUrl rejects empty filename defensively', async () => {
    await expect(
      generatePresignedUrl({ mime: 'image/png', size: 100, filename: '   ' })
    ).rejects.toThrow(DomainValidationError);
  });

  it('generatePresignedUrl rejects out-of-range size defensively', async () => {
    await expect(
      generatePresignedUrl({ mime: 'image/png', size: 0, filename: 'x.png' })
    ).rejects.toThrow(DomainValidationError);

    await expect(
      generatePresignedUrl({ mime: 'image/png', size: 5_242_881, filename: 'x.png' })
    ).rejects.toThrow(DomainValidationError);
  });

  it('confirmUpload throws NOT_FOUND when upload id does not exist', async () => {
    findUploadByIdMock.mockResolvedValue(null);

    await expect(confirmUpload('missing-id')).rejects.toThrow(NotFoundError);
  });

  it('confirmUpload throws CONFLICT when upload is not pending', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      status: 'processed',
    });

    await expect(confirmUpload('upload-1')).rejects.toThrow(ConflictError);
  });

  it('confirmUpload throws NOT_FOUND_IN_BUCKET when object does not exist', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });
    statMock.mockResolvedValueOnce(null);

    await expect(confirmUpload('upload-1')).rejects.toThrow(NotFoundError);
  });

  it('confirmUpload rejects stored size mismatches', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });
    statMock.mockResolvedValueOnce({ size: 4096, type: 'image/jpeg' });

    await expect(confirmUpload('upload-1')).rejects.toThrow(DomainValidationError);
    expect(txInsertValuesMock).not.toHaveBeenCalled();
  });

  it('confirmUpload rejects objects above the absolute size cap even within tolerance', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: MAX_UPLOAD_BYTES,
      status: 'pending',
    });
    statMock.mockResolvedValueOnce({ size: MAX_UPLOAD_BYTES + 1024, type: 'image/jpeg' });

    await expect(confirmUpload('upload-1')).rejects.toThrow(DomainValidationError);
    expect(txInsertValuesMock).not.toHaveBeenCalled();
  });

  it('confirmUpload rejects MIME mismatches', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });
    statMock.mockResolvedValueOnce({ size: 1024, type: 'image/png' });

    await expect(confirmUpload('upload-1')).rejects.toThrow(DomainValidationError);
    expect(txInsertValuesMock).not.toHaveBeenCalled();
  });

  it('confirmUpload rejects magic-byte mismatches', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });
    arrayBufferMock.mockResolvedValueOnce(
      makeArrayBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    );

    await expect(confirmUpload('upload-1')).rejects.toThrow(DomainValidationError);
    expect(txInsertValuesMock).not.toHaveBeenCalled();
  });

  it('confirmUpload updates status and writes an outbox event on success', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });

    const result = await confirmUpload('upload-1');

    // confirmUpload now uses db.transaction with outbox;
    // updateUpload (repo fn) and enqueueImageOptimize are no longer called directly.
    expect(updateUploadMock).not.toHaveBeenCalled();
    expect(enqueueImageOptimizeMock).not.toHaveBeenCalled();
    expect(txInsertValuesMock).toHaveBeenCalledWith({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId: 'upload-1' },
    });
    expect(result).toMatchObject({ id: 'upload-1', status: 'uploaded' });
    expect(result.originalUrl).toContain('/uploads/');
    expect(result.variants?.thumbnail).toContain('thumb');
  });

  it('confirmUpload throws CONFLICT when concurrent request already processed', async () => {
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });
    // tx.update returns no row — the WHERE guard prevents double-processing
    txUpdateReturningMock.mockResolvedValueOnce([]);

    await expect(confirmUpload('upload-1')).rejects.toThrow(ConflictError);
    expect(enqueueImageOptimizeMock).not.toHaveBeenCalled();
  });

  it('confirmUpload uses storageKey directly for S3 existence check when present', async () => {
    const { s3 } = await import('../config/s3');
    findUploadByIdMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/my-canonical-key.jpg',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/my-canonical-key.jpg',
      mime: 'image/jpeg',
      size: 1024,
      status: 'pending',
    });

    await confirmUpload('upload-1');

    // s3.file() must have been called with the storageKey value, not a URL-derived key
    expect(s3.file).toHaveBeenCalledWith('uploads/2026/02/my-canonical-key.jpg');
  });
});

describe('getUploadById service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the upload record when found', async () => {
    const mockRecord = {
      id: 'upload-1',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
      optimizedUrl: 'https://cdn.example.com/uploads/2026/02/file-opt.webp',
      variants: {
        thumbnail: 'https://cdn.example.com/uploads/2026/02/file-thumb.webp',
        medium: 'https://cdn.example.com/uploads/2026/02/file-medium.webp',
      },
      mime: 'image/jpeg',
      size: 1024,
      width: 800,
      height: 600,
      status: 'processed',
      createdAt: new Date(),
    };
    findUploadByIdMock.mockResolvedValue(mockRecord);

    const result = await getUploadById('upload-1');

    expect(result).toEqual(mockRecord);
    expect(findUploadByIdMock).toHaveBeenCalledWith('upload-1');
  });

  it('throws NOT_FOUND when upload does not exist', async () => {
    findUploadByIdMock.mockResolvedValue(null);

    await expect(getUploadById('missing-id')).rejects.toThrow(NotFoundError);
  });

  it('returns upload with uploaded status while still processing', async () => {
    const mockRecord = {
      id: 'upload-2',
      originalUrl: 'https://cdn.example.com/uploads/2026/02/file2.png',
      optimizedUrl: null,
      variants: null,
      mime: 'image/png',
      size: 2048,
      width: null,
      height: null,
      status: 'uploaded',
      createdAt: new Date(),
    };
    findUploadByIdMock.mockResolvedValue(mockRecord);

    const result = await getUploadById('upload-2');

    expect(result.status).toBe('uploaded');
    expect(result.optimizedUrl).toBeNull();
  });
});
