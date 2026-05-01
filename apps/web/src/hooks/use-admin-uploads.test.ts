import type { Upload } from '@portfolio/shared/types/uploads';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUploadErrorMessage, resolveUploadEffectiveUrl } from './upload-helpers';
import { pollUntilProcessed, useAdminUpload } from './use-admin-uploads';

const apiFetchMock = vi.fn();
const toastErrorMock = vi.fn();

// Prevent api.ts → env.ts → process.exit(1) during import
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

class MockXMLHttpRequest {
  readonly upload = {
    addEventListener: (event: string, listener: (event: ProgressEvent<EventTarget>) => void) => {
      this.uploadListeners.set(event, listener);
    },
  };

  private readonly listeners = new Map<string, () => void>();
  private readonly uploadListeners = new Map<string, (event: ProgressEvent<EventTarget>) => void>();

  status = 200;

  open(): void {}

  setRequestHeader(): void {}

  addEventListener(event: string, listener: () => void): void {
    this.listeners.set(event, listener);
  }

  send(file: Blob): void {
    this.uploadListeners.get('progress')?.({
      lengthComputable: true,
      loaded: file.size,
      total: file.size,
    } as ProgressEvent<EventTarget>);
    this.listeners.get('load')?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
});

afterEach(() => {
  vi.useRealTimers();
});

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

describe('useAdminUpload', () => {
  it('transitions to failed when the backend returns a terminal failed status after confirm', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        data: {
          presignedUrl: 'https://storage.example.com/presigned',
          uploadId: 'upload-1',
        },
      })
      .mockResolvedValueOnce({ data: makeUpload({ id: 'upload-1', status: 'uploaded' }) })
      .mockResolvedValueOnce({ data: makeUpload({ id: 'upload-1', status: 'failed' }) });

    const { result } = renderHook(() => useAdminUpload());
    const file = new File(['image-bytes'], 'cover.jpg', { type: 'image/jpeg' });

    let uploadResult: Upload | null = null;
    await act(async () => {
      uploadResult = await result.current.upload(file);
    });

    await waitFor(() => {
      expect(result.current.state.stage).toBe('failed');
    });

    expect(uploadResult).toBeNull();
    expect(result.current.state.errorCode).toBe('PROCESSING_FAILED');
    expect(result.current.state.error).toBe(
      'Otimização da imagem falhou. Tente fazer o upload novamente.'
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Upload falhou: Otimização da imagem falhou. Tente fazer o upload novamente.'
    );
  });

  it('transitions to timeout when terminal processing is not observed in time', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/admin/uploads/presign') {
        return {
          data: {
            presignedUrl: 'https://storage.example.com/presigned',
            uploadId: 'upload-1',
          },
        };
      }

      if (path === '/admin/uploads/upload-1/confirm') {
        return { data: makeUpload({ id: 'upload-1', status: 'uploaded' }) };
      }

      return { data: makeUpload({ id: 'upload-1', status: 'uploaded' }) };
    });

    const { result } = renderHook(() =>
      useAdminUpload({ pollMaxAttempts: 3, pollInitialDelayMs: 0, pollMaxDelayMs: 0 })
    );
    const file = new File(['image-bytes'], 'cover.jpg', { type: 'image/jpeg' });

    let uploadResult: Upload | null = null;
    await act(async () => {
      uploadResult = await result.current.upload(file);
    });

    await waitFor(() => {
      expect(result.current.state.stage).toBe('timeout');
    });

    expect(uploadResult).toBeNull();
    expect(result.current.state.errorCode).toBe('PROCESSING_TIMEOUT');
    expect(result.current.state.error).toBe(
      'Tempo limite de processamento excedido. Tente reenviar a imagem.'
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Upload falhou: Tempo limite de processamento excedido. Tente reenviar a imagem.'
    );
  });
});
