import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createRateLimitMock,
  createContactMock,
  validateTurnstileMock,
  enqueueTelegramNotificationMock,
  getClientIpMock,
} = vi.hoisted(() => ({
  createRateLimitMock: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => await next()),
  createContactMock: vi.fn(),
  validateTurnstileMock: vi.fn().mockResolvedValue(true),
  enqueueTelegramNotificationMock: vi.fn().mockResolvedValue(undefined),
  getClientIpMock: vi.fn().mockReturnValue('203.0.113.10'),
}));

vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: createRateLimitMock,
  getClientIp: getClientIpMock,
}));

vi.mock('../../repositories/contacts.repo', () => ({
  createContact: createContactMock,
}));

vi.mock('../../lib/turnstile', () => ({
  validateTurnstile: validateTurnstileMock,
}));

vi.mock('../../lib/queues', () => ({
  enqueueTelegramNotification: enqueueTelegramNotificationMock,
}));

import { contactRouter } from './contact';

describe('public contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContactMock.mockResolvedValue({ id: 1 });
  });

  it('returns 400 when body validation fails', async () => {
    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
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

  it('returns fake success and skips insert when honeypot is filled', async () => {
    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
        website: 'https://spam.example.com',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: {
        message: 'Message received',
      },
    });
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('returns 400 when turnstile validation fails', async () => {
    validateTurnstileMock.mockResolvedValueOnce(false);

    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
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
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('creates contact on valid payload', async () => {
    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: {
        message: 'Message sent successfully',
      },
    });
    expect(createContactMock).toHaveBeenCalledWith({
      name: 'Tester',
      email: 'tester@example.com',
      message: 'Mensagem suficientemente longa para passar validação.',
    });
    expect(enqueueTelegramNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'contact',
        name: 'Tester',
        email: 'tester@example.com',
      })
    );
  });

  it('still returns 201 when Telegram enqueue fails (fire-and-forget)', async () => {
    enqueueTelegramNotificationMock.mockRejectedValueOnce(new Error('Redis unavailable'));

    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
      }),
    });

    const body = await response.json();

    // Contact must be persisted and 201 returned even when the queue is down
    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: { message: 'Message sent successfully' },
    });
    expect(createContactMock).toHaveBeenCalledOnce();
  });
});
