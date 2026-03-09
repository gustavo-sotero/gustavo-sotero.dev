/**
 * Tests for admin contact management routes.
 *
 * Covers:
 *  GET   /admin/contacts          - paginated list with optional read filter
 *  PATCH /admin/contacts/:id/read - mark a message as read
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyContactsMock, findContactByIdMock, markContactAsReadMock } = vi.hoisted(() => ({
  findManyContactsMock: vi.fn(),
  findContactByIdMock: vi.fn(),
  markContactAsReadMock: vi.fn(),
}));

vi.mock('../../repositories/contacts.repo', () => ({
  findManyContacts: findManyContactsMock,
  findContactById: findContactByIdMock,
  markContactAsRead: markContactAsReadMock,
}));

import { adminContactsRouter } from './contacts';

const baseContact = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  message: 'Hello team!',
  createdAt: new Date('2026-02-01'),
  readAt: null,
};

function makeApp() {
  const app = new Hono();
  app.route('/admin/contacts', adminContactsRouter);
  return app;
}

describe('admin contacts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /admin/contacts', () => {
    it('returns paginated contact list', async () => {
      findManyContactsMock.mockResolvedValueOnce({
        data: [baseContact],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const app = makeApp();
      const response = await app.request('/admin/contacts');
      const body = (await response.json()) as {
        success: boolean;
        data: unknown[];
        meta: unknown;
      };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(findManyContactsMock).toHaveBeenCalledWith(
        expect.objectContaining({ read: undefined })
      );
    });

    it('passes read=true filter when query param is "true"', async () => {
      findManyContactsMock.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      const app = makeApp();
      await app.request('/admin/contacts?read=true');

      expect(findManyContactsMock).toHaveBeenCalledWith(expect.objectContaining({ read: true }));
    });

    it('passes read=false filter when query param is "false"', async () => {
      findManyContactsMock.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      const app = makeApp();
      await app.request('/admin/contacts?read=false');

      expect(findManyContactsMock).toHaveBeenCalledWith(expect.objectContaining({ read: false }));
    });

    it('returns 400 when read param has an invalid value', async () => {
      const app = makeApp();
      const response = await app.request('/admin/contacts?read=maybe');
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid value for "read" — expected "true" or "false"',
        },
      });
    });
  });

  describe('PATCH /admin/contacts/:id/read', () => {
    it('returns 400 for a non-integer contact ID', async () => {
      const app = makeApp();
      const response = await app.request('/admin/contacts/abc/read', { method: 'PATCH' });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when contact does not exist', async () => {
      findContactByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/contacts/999/read', { method: 'PATCH' });
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(response.status).toBe(404);
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Contact not found' },
      });
    });

    it('returns current state without updating when already read (idempotent)', async () => {
      const alreadyRead = { ...baseContact, readAt: new Date('2026-02-02') };
      findContactByIdMock.mockResolvedValueOnce(alreadyRead);

      const app = makeApp();
      const response = await app.request('/admin/contacts/1/read', { method: 'PATCH' });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(markContactAsReadMock).not.toHaveBeenCalled();
    });

    it('marks contact as read and returns updated record', async () => {
      const updated = { ...baseContact, readAt: new Date() };
      findContactByIdMock.mockResolvedValueOnce(baseContact);
      markContactAsReadMock.mockResolvedValueOnce(updated);

      const app = makeApp();
      const response = await app.request('/admin/contacts/1/read', { method: 'PATCH' });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(markContactAsReadMock).toHaveBeenCalledWith(1);
    });
  });
});
