import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createRateLimitMock,
  isCommentEmailInCooldownMock,
  setCommentEmailCooldownMock,
  getClientIpMock,
  hashIpMock,
  insertValuesMock,
  insertMock,
  selectMock,
  validateTurnstileMock,
  enqueueTelegramNotificationMock,
  findCommentByIdMock,
  renderCommentMarkdownMock,
} = vi.hoisted(() => {
  const insertValuesMockInner = vi.fn().mockResolvedValue([{ id: 'comment-id' }]);

  return {
    createRateLimitMock: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => await next()
    ),
    isCommentEmailInCooldownMock: vi.fn(),
    setCommentEmailCooldownMock: vi.fn(),
    getClientIpMock: vi.fn(() => '203.0.113.10'),
    hashIpMock: vi.fn().mockResolvedValue('hashed-ip'),
    insertValuesMock: insertValuesMockInner,
    insertMock: vi.fn().mockReturnValue({ values: insertValuesMockInner }),
    selectMock: vi.fn(),
    validateTurnstileMock: vi.fn().mockResolvedValue(true),
    enqueueTelegramNotificationMock: vi.fn().mockResolvedValue(undefined),
    findCommentByIdMock: vi.fn(),
    renderCommentMarkdownMock: vi.fn().mockResolvedValue('<p>Comentário válido</p>'),
  };
});

vi.mock('../../repositories/comments.repo', () => ({
  findCommentById: findCommentByIdMock,
}));

vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: createRateLimitMock,
  isCommentEmailInCooldown: isCommentEmailInCooldownMock,
  setCommentEmailCooldown: setCommentEmailCooldownMock,
  getClientIp: getClientIpMock,
}));

vi.mock('../../lib/turnstile', () => ({
  validateTurnstile: validateTurnstileMock,
}));

vi.mock('../../lib/queues', () => ({
  enqueueTelegramNotification: enqueueTelegramNotificationMock,
}));

vi.mock('../../lib/hash', () => ({
  hashIp: hashIpMock,
}));

vi.mock('../../lib/markdownComment', () => ({
  renderCommentMarkdown: renderCommentMarkdownMock,
}));

vi.mock('../../config/env', () => ({
  env: {
    IP_HASH_SALT: '1234567890123456',
  },
}));

vi.mock('../../config/db', () => ({
  db: {
    select: selectMock,
    insert: insertMock,
  },
}));

import { commentsRouter } from './comments';

function mockSelectResult(result: Array<{ id: number; title?: string }>) {
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  });
}

describe('public comments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCommentEmailInCooldownMock.mockResolvedValue(false);
    setCommentEmailCooldownMock.mockResolvedValue(undefined);
    mockSelectResult([{ id: 1, title: 'Test Post' }]);
  });

  it('returns 400 when body validation fails', async () => {
    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when turnstile validation fails', async () => {
    validateTurnstileMock.mockResolvedValueOnce(false);

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        turnstileToken: 'invalid-token',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Security verification failed',
      },
    });
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('returns 429 when email cooldown is active', async () => {
    isCommentEmailInCooldownMock.mockResolvedValueOnce(true);

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Wait before commenting again',
      },
    });
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('returns 404 when post is not published or not found', async () => {
    mockSelectResult([]);

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 999,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Post not found',
      },
    });
  });

  it('creates a pending comment and sets cooldown on success', async () => {
    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: {
        message: 'Comment sent for moderation',
      },
    });
    expect(hashIpMock).toHaveBeenCalledWith('203.0.113.10', '1234567890123456');
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        renderedContent: '<p>Comentário válido</p>',
        status: 'pending',
        ipHash: 'hashed-ip',
      })
    );
    expect(setCommentEmailCooldownMock).toHaveBeenCalledWith('tester@example.com', 300);
    expect(enqueueTelegramNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'comment',
        postTitle: 'Test Post',
        authorName: 'Tester',
      })
    );
  });

  describe('reply (parentCommentId validation)', () => {
    const replyBody = {
      postId: 1,
      parentCommentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      authorName: 'Replier',
      authorEmail: 'replier@example.com',
      content: 'Resposta válida ao comentário',
      turnstileToken: 'token',
    };

    it('returns 404 when parent comment does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = new Hono();
      app.route('/comments', commentsRouter);

      const response = await app.request('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyBody),
      });

      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Parent comment not found' },
      });
      expect(insertValuesMock).not.toHaveBeenCalled();
    });

    it('returns 400 when parent comment belongs to a different post', async () => {
      findCommentByIdMock.mockResolvedValueOnce({
        id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        postId: 99, // different post
        deletedAt: null,
        status: 'approved',
      });

      const app = new Hono();
      app.route('/comments', commentsRouter);

      const response = await app.request('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyBody),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parent comment belongs to a different post',
        },
      });
      expect(insertValuesMock).not.toHaveBeenCalled();
    });

    it('returns 400 when parent comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce({
        id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        postId: 1,
        deletedAt: new Date(),
        status: 'approved',
      });

      const app = new Hono();
      app.route('/comments', commentsRouter);

      const response = await app.request('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyBody),
      });

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot reply to a deleted comment',
        },
      });
      expect(insertValuesMock).not.toHaveBeenCalled();
    });

    it('creates a reply (pending) when parent is valid', async () => {
      findCommentByIdMock.mockResolvedValueOnce({
        id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        postId: 1,
        deletedAt: null,
        status: 'approved',
      });

      const app = new Hono();
      app.route('/comments', commentsRouter);

      const response = await app.request('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyBody),
      });

      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 1,
          parentCommentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          authorName: 'Replier',
          status: 'pending',
          authorRole: 'guest',
        })
      );
    });
  });

  it('still returns 201 when Telegram enqueue fails (fire-and-forget)', async () => {
    enqueueTelegramNotificationMock.mockRejectedValueOnce(new Error('Redis unavailable'));

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    // Comment must be persisted and 201 returned even when the queue is down
    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: { message: 'Comment sent for moderation' },
    });
    expect(insertValuesMock).toHaveBeenCalledOnce();
  });
});
