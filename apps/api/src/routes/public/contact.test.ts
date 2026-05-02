import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError } from '../../lib/errors';

const { createRateLimitMock, submitContactMock, getClientIpMock } = vi.hoisted(() => ({
  createRateLimitMock: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => await next()),
  submitContactMock: vi.fn(),
  getClientIpMock: vi.fn().mockReturnValue('203.0.113.10'),
}));

vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: createRateLimitMock,
  getClientIp: getClientIpMock,
}));

vi.mock('../../services/contact.service', () => ({
  submitContact: submitContactMock,
}));

import { contactRouter } from './contact';

describe('public contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitContactMock.mockResolvedValue({ message: 'Message sent successfully' });
  });

  it('returns 400 when request body parsing fails', async () => {
    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps service validation errors to 400 responses', async () => {
    submitContactMock.mockRejectedValueOnce(
      new DomainValidationError('Invalid request body', [
        { field: 'name', message: 'Too small: expected string to have >=2 characters' },
      ])
    );

    const app = new Hono();
    app.route('/contact', contactRouter);

    const response = await app.request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        type: 'validation',
        message: 'Invalid request body',
        details: [
          {
            field: 'name',
            message: 'Too small: expected string to have >=2 characters',
          },
        ],
      },
    });
  });

  it('returns fake success when the service short-circuits honeypot submissions', async () => {
    submitContactMock.mockResolvedValueOnce({ message: 'Message received' });

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

    expect(submitContactMock).toHaveBeenCalledWith({
      body: {
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
      },
      ip: '203.0.113.10',
      requestId: undefined,
    });
  });
});
