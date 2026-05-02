import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError } from '../lib/errors';

const { createContactMock, enqueueTelegramNotificationMock, validateTurnstileMock } = vi.hoisted(
  () => ({
    createContactMock: vi.fn(),
    enqueueTelegramNotificationMock: vi.fn(),
    validateTurnstileMock: vi.fn().mockResolvedValue(true),
  })
);

vi.mock('../repositories/contacts.repo', () => ({
  createContact: createContactMock,
}));

vi.mock('../lib/queues', () => ({
  enqueueTelegramNotification: enqueueTelegramNotificationMock,
}));

vi.mock('../lib/turnstile', () => ({
  validateTurnstile: validateTurnstileMock,
}));

import { submitContact } from './contact.service';

describe('submitContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateTurnstileMock.mockResolvedValue(true);
  });

  it('returns fake success for honeypot submissions without side effects', async () => {
    const result = await submitContact({
      body: {
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
        website: 'https://spam.example.com',
      },
      ip: '203.0.113.10',
      requestId: 'req-1',
    });

    expect(result).toEqual({ message: 'Message received' });
    expect(validateTurnstileMock).not.toHaveBeenCalled();
    expect(createContactMock).not.toHaveBeenCalled();
    expect(enqueueTelegramNotificationMock).not.toHaveBeenCalled();
  });

  it('throws a domain validation error for invalid request bodies', async () => {
    await expect(
      submitContact({
        body: {},
        ip: '203.0.113.10',
        requestId: 'req-1',
      })
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(validateTurnstileMock).not.toHaveBeenCalled();
    expect(createContactMock).not.toHaveBeenCalled();
  });

  it('fails closed when turnstile verification fails', async () => {
    validateTurnstileMock.mockResolvedValueOnce(false);

    await expect(
      submitContact({
        body: {
          name: 'Tester',
          email: 'tester@example.com',
          message: 'Mensagem suficientemente longa para passar validação.',
          turnstileToken: 'invalid-token',
        },
        ip: '203.0.113.10',
        requestId: 'req-1',
      })
    ).rejects.toMatchObject({
      message: 'Security verification failed',
    });

    expect(validateTurnstileMock).toHaveBeenCalledWith('invalid-token', '203.0.113.10', {
      requestId: 'req-1',
    });
    expect(createContactMock).not.toHaveBeenCalled();
    expect(enqueueTelegramNotificationMock).not.toHaveBeenCalled();
  });

  it('persists the contact and enqueues a notification for valid submissions', async () => {
    const result = await submitContact({
      body: {
        name: 'Tester',
        email: 'tester@example.com',
        message: 'Mensagem suficientemente longa para passar validação.',
        turnstileToken: 'token',
      },
      ip: '203.0.113.10',
      requestId: 'req-1',
    });

    expect(result).toEqual({ message: 'Message sent successfully' });
    expect(createContactMock).toHaveBeenCalledWith({
      name: 'Tester',
      email: 'tester@example.com',
      message: 'Mensagem suficientemente longa para passar validação.',
    });
    expect(enqueueTelegramNotificationMock).toHaveBeenCalledWith({
      type: 'contact',
      name: 'Tester',
      email: 'tester@example.com',
      messagePreview: 'Mensagem suficientemente longa para passar validação.',
    });
  });
});
