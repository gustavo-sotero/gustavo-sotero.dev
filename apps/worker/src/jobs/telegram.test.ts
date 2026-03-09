/**
 * Tests for the Telegram notification job handler.
 *
 * Covers:
 *  - Correct message formatting for 'comment' type
 *  - Correct message formatting for 'contact' type
 *  - Throws on unknown type (skips gracefully)
 *  - Propagates errors from sendTelegramMessage to trigger retry
 */

import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTelegramMessageMock } = vi.hoisted(() => ({
  sendTelegramMessageMock: vi.fn(),
}));

vi.mock('../lib/telegram', () => ({
  sendTelegramMessage: sendTelegramMessageMock,
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { processTelegram, type TelegramJobPayload } from './telegram';

function makeJob(data: TelegramJobPayload, attemptsMade = 0): Job<TelegramJobPayload> {
  return {
    id: 'test-job-1',
    data,
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Job<TelegramJobPayload>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sendTelegramMessageMock.mockResolvedValue(undefined);
});

describe('processTelegram', () => {
  describe('comment type', () => {
    it('formats and sends a comment notification', async () => {
      const job = makeJob({
        type: 'comment',
        postTitle: 'My First Post',
        authorName: 'Alice',
        contentPreview: 'Great article!',
      });

      await processTelegram(job);

      expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
      const [text] = sendTelegramMessageMock.mock.calls[0] as [string];
      expect(text).toContain('New comment');
      expect(text).toContain('My First Post');
      expect(text).toContain('Alice');
      expect(text).toContain('Great article');
    });

    it('handles missing optional fields in comment', async () => {
      const job = makeJob({ type: 'comment' });

      await processTelegram(job);

      expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    });

    it('escapes special markdown characters in comment fields', async () => {
      const job = makeJob({
        type: 'comment',
        postTitle: 'Post_with_underscore',
        authorName: 'Bob [Author]',
        contentPreview: 'Content *bold*',
      });

      await processTelegram(job);

      const [text] = sendTelegramMessageMock.mock.calls[0] as [string];
      // Special chars should be escaped
      expect(text).not.toMatch(/(?<!\\)_/);
    });
  });

  describe('contact type', () => {
    it('formats and sends a contact notification', async () => {
      const job = makeJob({
        type: 'contact',
        name: 'Charlie',
        email: 'charlie@example.com',
        messagePreview: 'I need help with X',
      });

      await processTelegram(job);

      expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
      const [text] = sendTelegramMessageMock.mock.calls[0] as [string];
      expect(text).toContain('New contact message');
      expect(text).toContain('Charlie');
      expect(text).toContain('charlie@example.com');
      expect(text).toContain('I need help with X');
    });

    it('handles missing optional fields in contact', async () => {
      const job = makeJob({ type: 'contact' });

      await processTelegram(job);

      expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('propagates errors from sendTelegramMessage so BullMQ can retry', async () => {
      const error = new Error('Telegram API unreachable');
      sendTelegramMessageMock.mockRejectedValue(error);

      const job = makeJob({ type: 'contact', name: 'Dave' });

      await expect(processTelegram(job)).rejects.toThrow('Telegram API unreachable');
    });

    it('skips gracefully for unknown type without throwing', async () => {
      const job = makeJob({ type: 'unknown' as unknown as TelegramJobPayload['type'] });

      await expect(processTelegram(job)).resolves.toBeUndefined();
      expect(sendTelegramMessageMock).not.toHaveBeenCalled();
    });
  });
});
