import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError, NotFoundError, RateLimitedError } from '../../lib/errors';
import { expectErrorEnvelope } from '../../test/expectErrorEnvelope';

const { createRateLimitMock, getClientIpMock, validateTurnstileMock, submitCommentMock } =
  vi.hoisted(() => ({
    createRateLimitMock: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => await next()
    ),
    getClientIpMock: vi.fn(() => '203.0.113.10'),
    validateTurnstileMock: vi.fn().mockResolvedValue(true),
    submitCommentMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: createRateLimitMock,
  getClientIp: getClientIpMock,
}));

vi.mock('../../lib/turnstile', () => ({
  validateTurnstile: validateTurnstileMock,
}));

vi.mock('../../services/comments.service', () => ({
  submitComment: submitCommentMock,
}));

vi.mock('../../config/env', () => ({
  env: {
    IP_HASH_SALT: '1234567890123456',
  },
}));

import { commentsRouter } from './comments';

const validBody = {
  postId: 1,
  authorName: 'Tester',
  authorEmail: 'tester@example.com',
  content: 'Comentário válido',
  turnstileToken: 'token',
};

describe('public comments route', () => {
  beforeEach(() => vi.clearAllMocks());

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
      body: JSON.stringify({ ...validBody, turnstileToken: 'invalid-token' }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expectErrorEnvelope(body, 'VALIDATION_ERROR', 'Security verification failed');
    expect(submitCommentMock).not.toHaveBeenCalled();
  });

  it('calls submitComment with the correct input on valid request', async () => {
    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, data: { message: 'Comment sent for moderation' } });
    expect(submitCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 1,
        authorName: 'Tester',
        authorEmail: 'tester@example.com',
        content: 'Comentário válido',
        ip: '203.0.113.10',
      })
    );
  });

  it('returns 429 when service throws RateLimitedError', async () => {
    submitCommentMock.mockRejectedValueOnce(new RateLimitedError('Wait before commenting again'));

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const body = await response.json();

    expect(response.status).toBe(429);
    expectErrorEnvelope(body, 'RATE_LIMITED', 'Wait before commenting again');
  });

  it('returns 404 when service throws NotFoundError (post not found)', async () => {
    submitCommentMock.mockRejectedValueOnce(new NotFoundError('Post not found'));

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const body = await response.json();

    expect(response.status).toBe(404);
    expectErrorEnvelope(body, 'NOT_FOUND', 'Post not found');
  });

  it('returns 404 when service throws NotFoundError (parent comment not found)', async () => {
    submitCommentMock.mockRejectedValueOnce(new NotFoundError('Parent comment not found'));

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        parentCommentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(404);
    expectErrorEnvelope(body, 'NOT_FOUND', 'Parent comment not found');
  });

  it('returns 400 when service throws DomainValidationError (cross-post parent)', async () => {
    submitCommentMock.mockRejectedValueOnce(
      new DomainValidationError('Parent comment belongs to a different post')
    );

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        parentCommentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expectErrorEnvelope(body, 'VALIDATION_ERROR', 'Parent comment belongs to a different post');
  });

  it('returns 400 when service throws DomainValidationError (deleted parent)', async () => {
    submitCommentMock.mockRejectedValueOnce(
      new DomainValidationError('Cannot reply to a deleted comment')
    );

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        parentCommentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expectErrorEnvelope(body, 'VALIDATION_ERROR', 'Cannot reply to a deleted comment');
  });

  it('propagates unrecognized errors (does not catch non-domain errors)', async () => {
    submitCommentMock.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const app = new Hono();
    app.route('/comments', commentsRouter);

    const response = await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    // Without a global error handler, Hono returns 500 for unhandled errors
    expect(response.status).toBe(500);
  });

  it('passes the client IP to the service', async () => {
    getClientIpMock.mockReturnValueOnce('10.0.0.1');

    const app = new Hono();
    app.route('/comments', commentsRouter);

    await app.request('/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(submitCommentMock).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.1' }));
  });
});
