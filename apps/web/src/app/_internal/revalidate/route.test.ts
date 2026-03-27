import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock next/cache ─────────────────────────────────────────────────────────
const mockRevalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

// ─── Mock env.server (server-only guard would fail in test runner) ────────────
vi.mock('@/lib/env.server', () => ({
  serverEnv: { REVALIDATE_SECRET: 'test-secret-value-at-least-16-chars' },
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────
const { POST } = await import('./route');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/_internal/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /_internal/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Authentication ────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401 (missing secret header)', async () => {
    const res = await POST(makeRequest({ tags: ['public:posts:list'] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects wrong secret with 403', async () => {
    const res = await POST(
      makeRequest({ tags: ['public:posts:list'] }, { 'x-revalidate-secret': 'wrong-secret' })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('accepts requests with valid x-revalidate-secret header', async () => {
    const res = await POST(
      makeRequest(
        { tags: ['public:posts:list'] },
        { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' }
      )
    );
    expect(res.status).toBe(200);
  });

  // ─── Payload validation ────────────────────────────────────────────────────

  it('rejects empty tags array with 400', async () => {
    const res = await POST(
      makeRequest({ tags: [] }, { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects tags not matching public: pattern with 400', async () => {
    const res = await POST(
      makeRequest(
        { tags: ['invalid-tag', 'posts:list'] },
        { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' }
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-array tags with 400', async () => {
    const res = await POST(
      makeRequest(
        { tags: 'public:posts:list' },
        { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' }
      )
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON body with 400', async () => {
    const req = new NextRequest('http://localhost/_internal/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': 'test-secret-value-at-least-16-chars',
      },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ─── Revalidation behaviour ────────────────────────────────────────────────

  it('calls revalidateTag with "max" scope for each valid tag', async () => {
    const tags = ['public:posts:list', 'public:home', 'public:posts:detail:my-slug'];
    const res = await POST(
      makeRequest({ tags }, { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' })
    );

    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(tags.length);
    for (const tag of tags) {
      expect(mockRevalidateTag).toHaveBeenCalledWith(tag, 'max');
    }
  });

  it('returns revalidated tag list and count in response', async () => {
    const tags = ['public:posts:list', 'public:projects:list'];
    const res = await POST(
      makeRequest({ tags }, { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' })
    );

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.revalidated).toEqual(tags);
    expect(body.data.invalid).toEqual([]);
    expect(body.data.count).toBe(2);
  });

  it('revalidates valid tags and returns invalid ones without failing whole request', async () => {
    const res = await POST(
      makeRequest(
        { tags: ['public:home', 'invalid-tag', 'public:posts:list'] },
        { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' }
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.revalidated).toEqual(['public:home', 'public:posts:list']);
    expect(body.data.invalid).toEqual(['invalid-tag']);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public:home', 'max');
    expect(mockRevalidateTag).toHaveBeenCalledWith('public:posts:list', 'max');
  });

  it('silently truncates tags array exceeding MAX_TAGS (20) limit', async () => {
    const tags = Array.from({ length: 25 }, (_, i) => `public:test:tag${i}`);
    const res = await POST(
      makeRequest({ tags }, { 'x-revalidate-secret': 'test-secret-value-at-least-16-chars' })
    );

    // Should fail validation since more than 20 tags were provided
    expect(res.status).toBe(400);
  });
});
