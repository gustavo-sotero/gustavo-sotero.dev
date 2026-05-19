import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPortableWebpVariants } from './image-variants';

const { metadataMock, resizeMock, webpMock, bufferMock } = vi.hoisted(() => ({
  metadataMock: vi.fn(),
  resizeMock: vi.fn(),
  webpMock: vi.fn(),
  bufferMock: vi.fn(),
}));

describe('buildPortableWebpVariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resizeMock.mockImplementation(() => ({
      webp: webpMock,
    }));
    webpMock.mockImplementation(() => ({
      buffer: bufferMock,
    }));

    function BunImageMock() {
      return {
        metadata: metadataMock,
        resize: resizeMock,
      };
    }

    vi.stubGlobal('Bun', {
      ...(globalThis as typeof globalThis & { Bun?: object }).Bun,
      Image: BunImageMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns source metadata and every requested WebP variant', async () => {
    metadataMock.mockResolvedValue({ width: 1600, height: 900 });
    bufferMock
      .mockResolvedValueOnce(Uint8Array.from([1, 2, 3]))
      .mockResolvedValueOnce(Uint8Array.from([4, 5, 6]));

    const result = await buildPortableWebpVariants(Uint8Array.from([9, 9, 9]), [
      { key: 'thumb', maxWidth: 400, quality: 80 },
      { key: 'cover', maxWidth: 1200, maxHeight: 1200, quality: 85 },
    ] as const);

    expect(result.metadata).toEqual({ width: 1600, height: 900 });
    expect(result.variants.thumb).toEqual({
      bytes: Uint8Array.from([1, 2, 3]),
      mime: 'image/webp',
    });
    expect(result.variants.cover).toEqual({
      bytes: Uint8Array.from([4, 5, 6]),
      mime: 'image/webp',
    });
    expect(resizeMock).toHaveBeenNthCalledWith(1, 400, 400, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(resizeMock).toHaveBeenNthCalledWith(2, 1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(webpMock).toHaveBeenNthCalledWith(1, { quality: 80 });
    expect(webpMock).toHaveBeenNthCalledWith(2, { quality: 85 });
  });

  it('throws a clear error when Bun.Image is unavailable', async () => {
    vi.unstubAllGlobals();

    await expect(
      buildPortableWebpVariants(Uint8Array.from([1]), [
        { key: 'thumb', maxWidth: 400, quality: 80 },
      ])
    ).rejects.toThrow('Bun.Image is not available in this runtime');
  });
});
