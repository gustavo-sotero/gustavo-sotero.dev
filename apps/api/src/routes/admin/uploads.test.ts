import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  generatePresignedUrlMock,
  confirmUploadMock,
  getUploadByIdMock,
}: {
  generatePresignedUrlMock: ReturnType<typeof vi.fn>;
  confirmUploadMock: ReturnType<typeof vi.fn>;
  getUploadByIdMock: ReturnType<typeof vi.fn>;
} = vi.hoisted(() => ({
  generatePresignedUrlMock: vi.fn(),
  confirmUploadMock: vi.fn(),
  getUploadByIdMock: vi.fn(),
}));

vi.mock('../../services/uploads.service', () => ({
  generatePresignedUrl: generatePresignedUrlMock,
  confirmUpload: confirmUploadMock,
  getUploadById: getUploadByIdMock,
}));

import { adminUploadsRouter } from './uploads';

const app = new Hono();
app.route('/admin/uploads', adminUploadsRouter);

type JsonResponse = {
  success: boolean;
  data?: {
    uploadId?: string;
    id?: string;
    storageKey?: string;
    originalUrl?: string;
    optimizedUrl?: string | null;
    variants?: { thumbnail?: string; medium?: string } | null;
    status?: string;
    message?: string;
  };
  error?: {
    code: string;
  };
};

describe('admin uploads routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid presign payload', async () => {
    const res = await app.request('/admin/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime: 'application/pdf', size: 100, filename: 'a.pdf' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 for valid presign payload', async () => {
    generatePresignedUrlMock.mockResolvedValue({
      presignedUrl: 'https://storage.example.com/presigned',
      key: 'uploads/2026/02/file.jpg',
      uploadId: 'upload-1',
    });

    const res = await app.request('/admin/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime: 'image/jpeg', size: 1024, filename: 'image.jpg' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(true);
    expect(body.data?.uploadId).toBe('upload-1');
  });

  it('returns 404 for confirm when upload is not found', async () => {
    confirmUploadMock.mockRejectedValue(
      Object.assign(new Error('Upload not found'), { code: 'NOT_FOUND' })
    );

    const res = await app.request('/admin/uploads/upload-missing/confirm', { method: 'POST' });

    expect(res.status).toBe(404);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('returns 409 for confirm conflict', async () => {
    confirmUploadMock.mockRejectedValue(
      Object.assign(new Error('Already processed'), { code: 'CONFLICT' })
    );

    const res = await app.request('/admin/uploads/upload-1/confirm', { method: 'POST' });

    expect(res.status).toBe(409);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('CONFLICT');
  });

  it('returns 404 for confirm when file is missing in storage', async () => {
    confirmUploadMock.mockRejectedValue(
      Object.assign(new Error('File not found in storage'), { code: 'NOT_FOUND_IN_BUCKET' })
    );

    const res = await app.request('/admin/uploads/upload-1/confirm', { method: 'POST' });

    expect(res.status).toBe(404);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('returns 200 for confirm success', async () => {
    confirmUploadMock.mockResolvedValue({
      id: 'upload-1',
      storageKey: 'uploads/2026/02/file.jpg',
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

    const res = await app.request('/admin/uploads/upload-1/confirm', { method: 'POST' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonResponse;
    expect(body.success).toBe(true);
    expect(body.data?.id).toBe('upload-1');
    expect(body.data?.originalUrl).toContain('uploads/');
    expect(body.data?.status).toBe('uploaded');
    expect(body.data?.variants?.thumbnail).toContain('thumb');
    expect(body.data?.message).toBe('Upload confirmado com sucesso.');
    expect(body.data?.storageKey).toBeUndefined();
  });

  describe('GET /admin/uploads/:id', () => {
    it('returns 200 with upload record when found', async () => {
      getUploadByIdMock.mockResolvedValue({
        id: 'upload-1',
        storageKey: 'uploads/2026/02/file.jpg',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/file.jpg',
        optimizedUrl: 'https://cdn.example.com/uploads/2026/02/file-optimized.webp',
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
      });

      const res = await app.request('/admin/uploads/upload-1', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = (await res.json()) as JsonResponse;
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe('upload-1');
      expect(body.data?.status).toBe('processed');
      expect(body.data?.optimizedUrl).toContain('optimized');
      expect(body.data?.storageKey).toBeUndefined();
    });

    it('returns 404 when upload not found', async () => {
      getUploadByIdMock.mockRejectedValue(
        Object.assign(new Error('Upload not found'), { code: 'NOT_FOUND' })
      );

      const res = await app.request('/admin/uploads/missing-id', { method: 'GET' });

      expect(res.status).toBe(404);
      const body = (await res.json()) as JsonResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('NOT_FOUND');
    });

    it('returns upload with null optimizedUrl when still processing', async () => {
      getUploadByIdMock.mockResolvedValue({
        id: 'upload-2',
        storageKey: 'uploads/2026/02/file2.jpg',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/file2.jpg',
        optimizedUrl: null,
        variants: null,
        mime: 'image/png',
        size: 2048,
        width: null,
        height: null,
        status: 'uploaded',
        createdAt: new Date(),
      });

      const res = await app.request('/admin/uploads/upload-2', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = (await res.json()) as JsonResponse;
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('uploaded');
      expect(body.data?.optimizedUrl).toBeNull();
      expect(body.data?.storageKey).toBeUndefined();
    });

    it('returns upload with failed status when relay terminal failure occurred', async () => {
      // Verifies that the admin UI can distinguish terminal backend failure vs active processing.
      // This state is set by the outbox relay when image-optimize delivery permanently fails
      // (after OUTBOX_MAX_ATTEMPTS) and queue.add() never succeeded.
      getUploadByIdMock.mockResolvedValue({
        id: 'upload-3',
        storageKey: 'uploads/2026/02/file3.jpg',
        originalUrl: 'https://cdn.example.com/uploads/2026/02/file3.jpg',
        optimizedUrl: null,
        variants: null,
        mime: 'image/jpeg',
        size: 512,
        width: null,
        height: null,
        status: 'failed',
        createdAt: new Date(),
      });

      const res = await app.request('/admin/uploads/upload-3', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = (await res.json()) as JsonResponse;
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe('upload-3');
      expect(body.data?.status).toBe('failed');
      expect(body.data?.optimizedUrl).toBeNull();
      expect(body.data?.variants).toBeNull();
      expect(body.data?.storageKey).toBeUndefined();
    });
  });
});
