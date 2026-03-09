import type { Upload } from '@portfolio/shared';
import { describe, expect, it, vi } from 'vitest';
import { getUploadErrorMessage, resolveUploadEffectiveUrl } from './upload-helpers';
import { pollUntilProcessed } from './use-admin-uploads';

// Prevent api.ts → env.ts → process.exit(1) during import
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

function makeUpload(overrides: Partial<Upload> = {}): Upload {
  return {
    id: 'upload-1',
    originalUrl: 'https://cdn.example.com/original.jpg',
    optimizedUrl: null,
    variants: null,
    mime: 'image/jpeg',
    size: 1234,
    width: null,
    height: null,
    status: 'uploaded',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useAdminUpload helpers', () => {
  it('prefers optimizedUrl over variants and original', () => {
    const url = resolveUploadEffectiveUrl(
      makeUpload({
        optimizedUrl: 'https://cdn.example.com/optimized.webp',
        variants: { medium: 'https://cdn.example.com/medium.webp' },
      })
    );

    expect(url).toBe('https://cdn.example.com/optimized.webp');
  });

  it('falls back to medium variant when optimizedUrl is missing', () => {
    const url = resolveUploadEffectiveUrl(
      makeUpload({
        optimizedUrl: null,
        variants: { medium: 'https://cdn.example.com/medium.webp' },
      })
    );

    expect(url).toBe('https://cdn.example.com/medium.webp');
  });

  it('falls back to originalUrl when optimized and variants are missing', () => {
    const url = resolveUploadEffectiveUrl(makeUpload({ optimizedUrl: null, variants: null }));
    expect(url).toBe('https://cdn.example.com/original.jpg');
  });

  it('extracts message from Error instances', () => {
    expect(getUploadErrorMessage(new Error('Falha no confirm'))).toBe('Falha no confirm');
  });

  it('extracts message from API error object shape', () => {
    const message = getUploadErrorMessage({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Upload já processado',
      },
    });

    expect(message).toBe('Upload já processado');
  });
});

describe('pollUntilProcessed', () => {
  function makeUpload(overrides: Partial<Upload> = {}): Upload {
    return {
      id: 'upload-1',
      originalUrl: 'https://cdn.example.com/original.jpg',
      optimizedUrl: null,
      variants: null,
      mime: 'image/jpeg',
      size: 1234,
      width: null,
      height: null,
      status: 'uploaded',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('resolves immediately when first response is processed', async () => {
    const processedUpload = makeUpload({
      status: 'processed',
      optimizedUrl: 'https://cdn.example.com/opt.webp',
    });
    const fetchFn = async () => ({ data: processedUpload });

    const result = await pollUntilProcessed('upload-1', fetchFn, 5, 0);

    expect(result.status).toBe('processed');
    expect(result.optimizedUrl).toBe('https://cdn.example.com/opt.webp');
  });

  it('resolves after transitioning through uploaded -> processed', async () => {
    const uploadedUpload = makeUpload({ status: 'uploaded' });
    const processedUpload = makeUpload({
      status: 'processed',
      optimizedUrl: 'https://cdn.example.com/opt.webp',
      variants: {
        thumbnail: 'https://cdn.example.com/thumb.webp',
        medium: 'https://cdn.example.com/medium.webp',
      },
    });

    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return { data: callCount < 3 ? uploadedUpload : processedUpload };
    };

    const result = await pollUntilProcessed('upload-1', fetchFn, 5, 0);

    expect(result.status).toBe('processed');
    expect(result.optimizedUrl).toBe('https://cdn.example.com/opt.webp');
    expect(callCount).toBe(3);
  });

  it('throws PROCESSING_FAILED when status is failed', async () => {
    const failedUpload = makeUpload({ status: 'failed' });
    const fetchFn = async () => ({ data: failedUpload });

    await expect(pollUntilProcessed('upload-1', fetchFn, 5, 0)).rejects.toMatchObject({
      code: 'PROCESSING_FAILED',
    });
  });

  it('throws PROCESSING_TIMEOUT when max attempts are exhausted', async () => {
    const uploadedUpload = makeUpload({ status: 'uploaded' });
    const fetchFn = async () => ({ data: uploadedUpload });

    await expect(pollUntilProcessed('upload-1', fetchFn, 3, 0)).rejects.toMatchObject({
      code: 'PROCESSING_TIMEOUT',
    });
  });

  it('does not propagate URL when processing fails', async () => {
    const failedUpload = makeUpload({ status: 'failed' });
    const fetchFn = async () => ({ data: failedUpload });

    let resolvedUpload: Upload | undefined;
    try {
      resolvedUpload = await pollUntilProcessed('upload-1', fetchFn, 5, 0);
    } catch {
      // expected
    }

    expect(resolvedUpload).toBeUndefined();
  });

  it('resolves with optimizedUrl as priority over variants and original', async () => {
    const processedUpload = makeUpload({
      status: 'processed',
      optimizedUrl: 'https://cdn.example.com/opt.webp',
      variants: {
        medium: 'https://cdn.example.com/medium.webp',
      },
    });
    const fetchFn = async () => ({ data: processedUpload });

    const result = await pollUntilProcessed('upload-1', fetchFn, 5, 0);

    // Resolved URL priority is handled by resolveUploadEffectiveUrl — verify the
    // data returned by pollUntilProcessed has all fields for correct resolution.
    expect(resolveUploadEffectiveUrl(result)).toBe('https://cdn.example.com/opt.webp');
  });

  it('falls back to variants.medium when optimizedUrl is absent', async () => {
    const processedUpload = makeUpload({
      status: 'processed',
      optimizedUrl: null,
      variants: { medium: 'https://cdn.example.com/medium.webp' },
    });
    const fetchFn = async () => ({ data: processedUpload });

    const result = await pollUntilProcessed('upload-1', fetchFn, 5, 0);

    expect(resolveUploadEffectiveUrl(result)).toBe('https://cdn.example.com/medium.webp');
  });
});
