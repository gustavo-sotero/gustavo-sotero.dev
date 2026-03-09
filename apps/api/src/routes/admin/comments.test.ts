/**
 * Tests for admin comment moderation routes.
 *
 * Covers:
 *  GET  /admin/comments                  - list with optional status filter
 *  POST /admin/comments/:id/approve      - approve a pending comment
 *  POST /admin/comments/:id/reject       - reject a pending comment
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../types/index';

const {
  findCommentByIdMock,
  updateCommentStatusMock,
  updateCommentContentMock,
  softDeleteCommentMock,
  renderCommentMarkdownMock,
  invalidatePatternMock,
  dbSelectMock,
  dbInsertMock,
} = vi.hoisted(() => {
  // Build a chainable db.select mock matching the exact call chain in the route:
  //   Count query:  select → from → where
  //   List query:   select → from → leftJoin → where → orderBy → limit → offset
  //   Post lookup:  select → from → where → limit
  const offsetMock = vi.fn().mockResolvedValue([]);
  const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock2 = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const leftJoinMock = vi.fn().mockReturnValue({ where: whereMock2 });
  const whereMock1 = vi.fn().mockResolvedValue([{ total: 0 }]);
  const fromMock = vi.fn().mockReturnValue({
    leftJoin: leftJoinMock,
    where: whereMock1,
  });
  const selectMockInner = vi.fn().mockReturnValue({ from: fromMock });

  const dbInsertValuesMockWithReturning = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'new-reply-id' }]),
  });

  return {
    findCommentByIdMock: vi.fn(),
    updateCommentStatusMock: vi.fn(),
    updateCommentContentMock: vi.fn(),
    softDeleteCommentMock: vi.fn(),
    renderCommentMarkdownMock: vi.fn().mockResolvedValue('<p>Edited</p>'),
    invalidatePatternMock: vi.fn().mockResolvedValue(undefined),
    dbSelectMock: selectMockInner,
    dbInsertMock: vi.fn().mockReturnValue({ values: dbInsertValuesMockWithReturning }),
  };
});

vi.mock('../../repositories/comments.repo', () => ({
  findCommentById: findCommentByIdMock,
  updateCommentStatus: updateCommentStatusMock,
  updateCommentContent: updateCommentContentMock,
  softDeleteComment: softDeleteCommentMock,
}));

vi.mock('../../lib/markdownComment', () => ({
  renderCommentMarkdown: renderCommentMarkdownMock,
}));

vi.mock('../../lib/cache', () => ({
  invalidatePattern: invalidatePatternMock,
}));

vi.mock('../../lib/pagination', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, perPage: 20, offset: 0, limit: 20 }),
  buildPaginationMeta: vi.fn().mockReturnValue({ page: 1, perPage: 20, total: 0, totalPages: 0 }),
}));

vi.mock('../../config/db', () => ({
  db: { select: dbSelectMock, insert: dbInsertMock },
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
const deletedComment = { ...pendingComment, deletedAt: new Date(), deletedBy: 'admin-github-id' };

// Helper to create an app instance that simulates the admin context
function makeApp(adminId = 'admin-github-id') {
  const app = new Hono<AppEnv>();
  // Inject adminId into context to simulate authAdmin middleware
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

  // ── Legacy: approve ──────────────────────────────────────────────────────────

  describe('POST /admin/comments/:id/approve (legacy)', () => {
    it('returns 404 when comment does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(response.status).toBe(404);
      expect(body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Comment not found' },
      });
    });

    it('returns 409 when comment is already approved', async () => {
      findCommentByIdMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('approves a pending comment and invalidates post cache', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      updateCommentStatusMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/approve', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(updateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'approved',
        'admin-github-id'
      );
      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });
  });

  // ── Legacy: reject ───────────────────────────────────────────────────────────

  describe('POST /admin/comments/:id/reject (legacy)', () => {
    it('returns 404 when comment does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 when comment is already rejected', async () => {
      findCommentByIdMock.mockResolvedValueOnce({ ...pendingComment, status: 'rejected' });

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('rejects a pending comment and records moderation metadata', async () => {
      const rejectedComment = {
        ...pendingComment,
        status: 'rejected',
        moderatedAt: new Date(),
        moderatedBy: 'admin-github-id',
      };
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      updateCommentStatusMock.mockResolvedValueOnce(rejectedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/reject', {
        method: 'POST',
      });
      const body = (await response.json()) as { success: boolean };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(updateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'rejected',
        'admin-github-id'
      );
    });

    it('does NOT call invalidatePattern when rejecting a non-approved comment', async () => {
      const rejectedComment = { ...pendingComment, status: 'rejected', moderatedAt: new Date() };
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      updateCommentStatusMock.mockResolvedValueOnce(rejectedComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/reject', { method: 'POST' });

      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });

    it('invalidates post cache when rejecting a previously approved comment', async () => {
      const rejectedComment = { ...approvedComment, status: 'rejected', moderatedAt: new Date() };
      findCommentByIdMock.mockResolvedValueOnce(approvedComment);
      updateCommentStatusMock.mockResolvedValueOnce(rejectedComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/reject', { method: 'POST' });

      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });
  });

  // ── PATCH /:id/status ─────────────────────────────────────────────────────────

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
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(409);
    });

    it('transitions pending → approved and invalidates post cache', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      updateCommentStatusMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(updateCommentStatusMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'approved',
        'admin-github-id'
      );
      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });

    it('transitions approved → rejected and invalidates post cache (was public)', async () => {
      findCommentByIdMock.mockResolvedValueOnce(approvedComment);
      updateCommentStatusMock.mockResolvedValueOnce({ ...pendingComment, status: 'rejected' });

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      expect(response.status).toBe(200);
      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });

    it('transitions rejected → pending without cache invalidation', async () => {
      findCommentByIdMock.mockResolvedValueOnce({ ...pendingComment, status: 'rejected' });
      updateCommentStatusMock.mockResolvedValueOnce(pendingComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });

      // Neither old nor new status is approved
      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });
  });

  // ── PATCH /:id/content ────────────────────────────────────────────────────────

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
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo conteúdo' }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo conteúdo' }),
      });

      expect(response.status).toBe(409);
    });

    it('edits comment content, re-renders markdown, and records edit metadata', async () => {
      const editedContent = 'conteúdo editado pelo admin';
      const updatedComment = {
        ...pendingComment,
        content: editedContent,
        renderedContent: '<p>conteúdo editado pelo admin</p>',
        editedAt: new Date(),
        editedBy: 'admin-github-id',
      };

      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      renderCommentMarkdownMock.mockResolvedValueOnce('<p>conteúdo editado pelo admin</p>');
      updateCommentContentMock.mockResolvedValueOnce(updatedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, reason: 'conteúdo ofensivo' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(renderCommentMarkdownMock).toHaveBeenCalledWith(editedContent);
      expect(updateCommentContentMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        editedContent,
        '<p>conteúdo editado pelo admin</p>',
        'admin-github-id',
        'conteúdo ofensivo'
      );
    });

    it('invalidates post cache when editing an approved comment', async () => {
      findCommentByIdMock.mockResolvedValueOnce(approvedComment);
      updateCommentContentMock.mockResolvedValueOnce(approvedComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo' }),
      });

      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });

    it('does NOT invalidate post cache when editing a non-approved comment', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      updateCommentContentMock.mockResolvedValueOnce(pendingComment);

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'novo' }),
      });

      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });
  });

  // ── DELETE /:id (soft delete) ─────────────────────────────────────────────────

  describe('DELETE /admin/comments/:id', () => {
    it('returns 404 when comment does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(null);

      const app = makeApp();
      const response = await app.request('/admin/comments/non-existent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 when comment is already deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

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

    it('soft-deletes a comment and records audit metadata', async () => {
      const softDeleted = {
        ...pendingComment,
        deletedAt: new Date(),
        deletedBy: 'admin-github-id',
        deleteReason: 'spam',
      };
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      softDeleteCommentMock.mockResolvedValueOnce(softDeleted);

      const app = makeApp();
      const response = await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'spam' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(softDeleteCommentMock).toHaveBeenCalledWith(
        'comment-uuid-1',
        'admin-github-id',
        'spam'
      );
    });

    it('invalidates post cache when deleting an approved comment', async () => {
      findCommentByIdMock.mockResolvedValueOnce(approvedComment);
      softDeleteCommentMock.mockResolvedValueOnce({ ...approvedComment, deletedAt: new Date() });

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });

    it('does NOT invalidate post cache when deleting a non-approved comment', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      softDeleteCommentMock.mockResolvedValueOnce({ ...pendingComment, deletedAt: new Date() });

      const app = makeApp();
      await app.request('/admin/comments/comment-uuid-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });
  });

  // ── POST /reply (admin-authored) ──────────────────────────────────────────────

  describe('POST /admin/comments/reply', () => {
    const replyPayload = {
      postId: 1,
      parentCommentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      content: 'Uma resposta do admin ao comentário.',
    };

    function mockPostLookup(result: Array<{ id: number }>) {
      const limitMock = vi.fn().mockResolvedValue(result);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      dbSelectMock.mockReturnValueOnce({ from: fromMock });
    }

    it('returns 400 when body is invalid', async () => {
      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: 1 }), // missing parentCommentId and content
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when parent comment does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(null);

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

    it('returns 400 when parent comment belongs to different post', async () => {
      findCommentByIdMock.mockResolvedValueOnce({ ...pendingComment, postId: 99 });

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(400);
    });

    it('returns 400 when parent comment is deleted', async () => {
      findCommentByIdMock.mockResolvedValueOnce(deletedComment);

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(400);
    });

    it('returns 404 when the target post does not exist', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      mockPostLookup([]); // post not found

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(404);
    });

    it('creates an admin reply auto-approved and invalidates post cache', async () => {
      findCommentByIdMock.mockResolvedValueOnce(pendingComment);
      mockPostLookup([{ id: 1 }]);
      dbInsertMock.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-reply-id', status: 'approved' }]),
        }),
      });

      const app = makeApp();
      const response = await app.request('/admin/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(invalidatePatternMock).toHaveBeenCalledWith('posts:slug:*');
    });
  });
});
