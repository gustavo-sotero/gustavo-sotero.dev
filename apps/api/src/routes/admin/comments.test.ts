/**
 * Tests for admin comment moderation routes.
 *
 * Covers:
 *  GET    /admin/comments             - list with optional status/postId/deleted filters
 *  POST   /admin/comments/reply       - admin-authored reply
 *  POST   /admin/comments/:id/approve - legacy approve
 *  POST   /admin/comments/:id/reject  - legacy reject
 *  PATCH  /admin/comments/:id/status  - status transition
 *  PATCH  /admin/comments/:id/content - content edit
 *  DELETE /admin/comments/:id         - soft delete
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError, NotFoundError } from '../../lib/errors';
import { expectErrorEnvelope } from '../../test/expectErrorEnvelope';
import type { AppEnv } from '../../types/index';

const {
  listAdminCommentsMock,
  createAdminReplyMock,
  moderateCommentStatusMock,
  editCommentContentMock,
  removeCommentMock,
  approveCommentMock,
  rejectCommentMock,
} = vi.hoisted(() => ({
  listAdminCommentsMock: vi.fn(),
  createAdminReplyMock: vi.fn(),
  moderateCommentStatusMock: vi.fn(),
  editCommentContentMock: vi.fn(),
  removeCommentMock: vi.fn(),
  approveCommentMock: vi.fn(),
  rejectCommentMock: vi.fn(),
}));

vi.mock('../../services/comments.admin.service', () => ({
  listAdminComments: listAdminCommentsMock,
  createAdminReply: createAdminReplyMock,
  moderateCommentStatus: moderateCommentStatusMock,
  editCommentContent: editCommentContentMock,
  removeComment: removeCommentMock,
  approveComment: approveCommentMock,
  rejectComment: rejectCommentMock,
}));

import { adminCommentsRouter } from './comments';

const pendingComment = {
  id: 'comment-uuid-1',
  postId: 1,
  authorName: 'Tester',
  authorEmail: 'tester@example.com',
  content: 'Nice post!',
  renderedContent: '<p>Nice post!</p>',
  status: 'pending',
  authorRole: 'guest',
  parentCommentId: null,
  ipHash: 'abc123',
  moderatedAt: null,
  moderatedBy: null,
  editedAt: null,
  editedBy: null,
  editReason: null,
  deletedAt: null,
  deletedBy: null,
  deleteReason: null,
  createdAt: new Date('2026-01-01'),
};

const approvedComment = { ...pendingComment, status: 'approved', moderatedAt: new Date() };

const emptyPageResult = {
  data: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

function makeApp(adminId = 'admin-github-id') {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('adminId', adminId);
    await next();
  });
  app.route('/admin/comments', adminCommentsRouter);
  return app;
}

describe('admin comments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminCommentsMock.mockResolvedValue(emptyPageResult);
  });

  describe('GET /admin/comments', () => {
    it('returns 400 for an invalid status value', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments?status=invalid');
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns paginated comment list with no filter', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments');

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        data: unknown[];
        meta: unknown;
      };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
    });

    it('accepts valid status filter values', async () => {
      const app = makeApp();

      for (const status of ['pending', 'approved', 'rejected']) {
        const response = await app.request(`/admin/comments?status=${status}`);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('POST /admin/comments/:id/approve (legacy)', () => {
    it('returns 404 when comment does not exist', async () => {
      approveCommentMock.mockRejectedValueOnce(new NotFoundError('Comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(response.status).toBe(404);
      expectErrorEnvelope(body, 'NOT_FOUND', 'Comment not found');
    });

    it('returns 409 when comment is already approved', async () => {
      approveCommentMock.mockRejectedValueOnce(
        new DomainValidationError('Comment is already approved')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when comment is deleted', async () => {
      approveCommentMock.mockRejectedValueOnce(
        new DomainValidationError('Cannot change status of a deleted comment')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('approves a pending comment', async () => {
      approveCommentMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(approveCommentMock).toHaveBeenCalledWith('comment-uuid-1', 'admin-github-id');
    });
  });

  describe('POST /admin/comments/:id/reject (legacy)', () => {
    it('returns 404 when comment does not exist', async () => {
      rejectCommentMock.mockRejectedValueOnce(new NotFoundError('Comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 when comment is already rejected', async () => {
      rejectCommentMock.mockRejectedValueOnce(
        new DomainValidationError('Comment is already rejected')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when comment is deleted', async () => {
      rejectCommentMock.mockRejectedValueOnce(
        new DomainValidationError('Cannot change status of a deleted comment')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('rejects a pending comment', async () => {
      const rejectedComment = {
        ...pendingComment,
        status: 'rejected',
        moderatedAt: new Date(),
        moderatedBy: 'admin-github-id',
      };
      rejectCommentMock.mockResolvedValueOnce(rejectedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(rejectCommentMock).toHaveBeenCalledWith('comment-uuid-1', 'admin-github-id');
    });
  });

  describe('PATCH /admin/comments/:id/status', () => {
    it('returns 400 for invalid status value', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hidden' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when comment does not exist', async () => {
      moderateCommentStatusMock.mockRejectedValueOnce(new NotFoundError('Comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is deleted', async () => {
      moderateCommentStatusMock.mockRejectedValueOnce(
        new DomainValidationError('Cannot change status of a deleted comment')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(409);
    });

    it('transitions pending to approved', async () => {
      moderateCommentStatusMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(moderateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'approved',
        'admin-github-id'
      );
    });

    it('transitions approved to rejected', async () => {
      moderateCommentStatusMock.mockResolvedValueOnce({
        ...pendingComment,
        status: 'rejected',
      });

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      expect(response.status).toBe(200);
      expect(moderateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'rejected',
        'admin-github-id'
      );
    });

    it('transitions rejected to pending', async () => {
      moderateCommentStatusMock.mockResolvedValueOnce(pendingComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });

      expect(moderateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'pending',
        'admin-github-id'
      );
    });
  });

  describe('PATCH /admin/comments/:id/content', () => {
    it('returns 400 when content is missing', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when comment does not exist', async () => {
      editCommentContentMock.mockRejectedValueOnce(new NotFoundError('Comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo conteudo' }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is deleted', async () => {
      editCommentContentMock.mockRejectedValueOnce(
        new DomainValidationError('Cannot edit a deleted comment')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo conteudo' }),
      });

      expect(response.status).toBe(409);
    });

    it('edits comment content and records edit metadata', async () => {
      const editedContent = 'conteudo editado pelo admin';
      const updatedComment = {
        ...pendingComment,
        content: editedContent,
        renderedContent: '<p>conteudo editado pelo admin</p>',
        editedAt: new Date(),
        editedBy: 'admin-github-id',
      };

      editCommentContentMock.mockResolvedValueOnce(updatedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, reason: 'conteudo ofensivo' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(editCommentContentMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        editedContent,
        'conteudo ofensivo',
        'admin-github-id'
      );
    });
  });

  describe('DELETE /admin/comments/:id', () => {
    it('returns 404 when comment does not exist', async () => {
      removeCommentMock.mockRejectedValueOnce(new NotFoundError('Comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is already deleted', async () => {
      removeCommentMock.mockRejectedValueOnce(
        new DomainValidationError('Comment is already deleted')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('CONFLICT');
    });

    it('soft-deletes a comment', async () => {
      const softDeleted = {
        ...pendingComment,
        deletedAt: new Date(),
        deletedBy: 'admin-github-id',
        deleteReason: 'spam',
      };
      removeCommentMock.mockResolvedValueOnce(softDeleted);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'spam' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(removeCommentMock).toHaveBeenCalledWith('comment-uuid-1', 'spam', 'admin-github-id');
    });

    it('soft-deletes without reason when body is omitted', async () => {
      removeCommentMock.mockResolvedValueOnce({ ...pendingComment, deletedAt: new Date() });

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /admin/comments/reply', () => {
    const replyPayload = {
      postId: 1,
      parentCommentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      content: 'Uma resposta do admin ao comentario.',
    };

    it('returns 400 when body is invalid', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: 1 }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when parent comment does not exist', async () => {
      createAdminReplyMock.mockRejectedValueOnce(new NotFoundError('Parent comment not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(404);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when post does not exist', async () => {
      createAdminReplyMock.mockRejectedValueOnce(new NotFoundError('Post not found'));

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when parent comment belongs to a different post', async () => {
      createAdminReplyMock.mockRejectedValueOnce(
        new DomainValidationError('Parent comment belongs to a different post')
      );

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(409);
    });

    it('creates a reply and returns 201', async () => {
      const newReply = { id: 'new-reply-id', ...replyPayload, status: 'approved' };
      createAdminReplyMock.mockResolvedValueOnce(newReply);

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(createAdminReplyMock).toHaveBeenCalledWith(replyPayload, 'admin-github-id');
    });
  });
});
