import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock next/cache ─────────────────────────────────────────────────────────
const mockRevalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────
const { revalidatePublicTags } = await import('./revalidate-tags');

describe('revalidatePublicTags (server action)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls revalidateTag with "max" for each valid tag', async () => {
    const tags = ['public:posts:list', 'public:home'];
    await revalidatePublicTags(tags);

    expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public:posts:list', 'max');
    expect(mockRevalidateTag).toHaveBeenCalledWith('public:home', 'max');
  });

  it('does nothing with an empty array', async () => {
    await revalidatePublicTags([]);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('filters out tags that do not start with "public:"', async () => {
    await revalidatePublicTags(['posts:list', 'invalid', 'public:posts:list']);
    // Only the valid public: tag should be revalidated
    expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public:posts:list', 'max');
  });

  it('silently truncates to MAX_TAGS (20) and does not throw', async () => {
    const tags = Array.from({ length: 30 }, (_, i) => `public:test:tag${i}`);
    await expect(revalidatePublicTags(tags)).resolves.toBeUndefined();
    expect(mockRevalidateTag).toHaveBeenCalledTimes(20);
  });

  it('does not throw if revalidateTag throws (best-effort)', async () => {
    mockRevalidateTag.mockImplementation(() => {
      throw new Error('Cache service unavailable');
    });

    await expect(revalidatePublicTags(['public:posts:list'])).resolves.toBeUndefined();
  });
});
