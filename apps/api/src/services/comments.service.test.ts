import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError, NotFoundError, RateLimitedError } from '../lib/errors';

const {
  hashIpMock,
  renderCommentMarkdownMock,
  enqueueTelegramNotificationMock,
  isCommentEmailInCooldownMock,
  setCommentEmailCooldownMock,
  createCommentMock,
  findCommentByIdMock,
  findPublicPostByIdMock,
} = vi.hoisted(() => ({
  hashIpMock: vi.fn(),
  renderCommentMarkdownMock: vi.fn(),
  enqueueTelegramNotificationMock: vi.fn(),
  isCommentEmailInCooldownMock: vi.fn(),
  setCommentEmailCooldownMock: vi.fn(),
  createCommentMock: vi.fn(),
  findCommentByIdMock: vi.fn(),
  findPublicPostByIdMock: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: {
    IP_HASH_SALT: '1234567890123456',
  },
}));

vi.mock('../lib/hash', () => ({
  hashIp: hashIpMock,
}));

vi.mock('../lib/markdownComment', () => ({
  renderCommentMarkdown: renderCommentMarkdownMock,
}));

vi.mock('../lib/queues', () => ({
  enqueueTelegramNotification: enqueueTelegramNotificationMock,
}));

vi.mock('../middleware/rateLimit', () => ({
  isCommentEmailInCooldown: isCommentEmailInCooldownMock,
  setCommentEmailCooldown: setCommentEmailCooldownMock,
}));

vi.mock('../repositories/comments.repo', () => ({
  createComment: createCommentMock,
  findCommentById: findCommentByIdMock,
}));

vi.mock('../repositories/posts.repo', () => ({
  findPublicPostById: findPublicPostByIdMock,
}));

import { submitComment } from './comments.service';

const baseInput = {
  postId: 42,
  authorName: 'Tester',
  authorEmail: 'tester@example.com',
  content: 'Hello from a test comment',
  ip: '203.0.113.10',
};

describe('submitComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCommentEmailInCooldownMock.mockResolvedValue(false);
    findPublicPostByIdMock.mockResolvedValue({ id: 42, title: 'Test post' });
    findCommentByIdMock.mockResolvedValue(null);
    hashIpMock.mockResolvedValue('hashed-ip');
    renderCommentMarkdownMock.mockResolvedValue('<p>Hello from a test comment</p>');
    setCommentEmailCooldownMock.mockResolvedValue(undefined);
    createCommentMock.mockResolvedValue({ id: 'comment-1' });
    enqueueTelegramNotificationMock.mockResolvedValue(undefined);
  });

  it('persists a pending guest comment and enqueues a notification', async () => {
    findCommentByIdMock.mockResolvedValue({
      id: 'parent-1',
      postId: 42,
      deletedAt: null,
    });

    await expect(
      submitComment({
        ...baseInput,
        parentCommentId: 'parent-1',
      })
    ).resolves.toBeUndefined();

    expect(isCommentEmailInCooldownMock).toHaveBeenCalledWith('tester@example.com');
    expect(findPublicPostByIdMock).toHaveBeenCalledWith(42);
    expect(findCommentByIdMock).toHaveBeenCalledWith('parent-1');
    expect(hashIpMock).toHaveBeenCalledWith('203.0.113.10', '1234567890123456');
    expect(renderCommentMarkdownMock).toHaveBeenCalledWith('Hello from a test comment');
    expect(setCommentEmailCooldownMock).toHaveBeenCalledWith('tester@example.com', 300);
    expect(createCommentMock).toHaveBeenCalledWith({
      postId: 42,
      parentCommentId: 'parent-1',
      authorName: 'Tester',
      authorEmail: 'tester@example.com',
      authorRole: 'guest',
      content: 'Hello from a test comment',
      renderedContent: '<p>Hello from a test comment</p>',
      status: 'pending',
      ipHash: 'hashed-ip',
    });
    expect(enqueueTelegramNotificationMock).toHaveBeenCalledWith({
      type: 'comment',
      postTitle: 'Test post',
      authorName: 'Tester',
      contentPreview: 'Hello from a test comment',
    });
  });

  it('throws RateLimitedError when the email is already in cooldown', async () => {
    isCommentEmailInCooldownMock.mockResolvedValue(true);

    await expect(submitComment(baseInput)).rejects.toBeInstanceOf(RateLimitedError);
    expect(findPublicPostByIdMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the target post does not exist', async () => {
    findPublicPostByIdMock.mockResolvedValue(null);

    await expect(submitComment(baseInput)).rejects.toBeInstanceOf(NotFoundError);
    expect(findCommentByIdMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the parent comment does not exist', async () => {
    findCommentByIdMock.mockResolvedValue(null);

    await expect(
      submitComment({
        ...baseInput,
        parentCommentId: 'missing-parent',
      })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('throws DomainValidationError when the parent belongs to another post', async () => {
    findCommentByIdMock.mockResolvedValue({
      id: 'parent-1',
      postId: 7,
      deletedAt: null,
    });

    await expect(
      submitComment({
        ...baseInput,
        parentCommentId: 'parent-1',
      })
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('throws DomainValidationError when replying to a deleted parent comment', async () => {
    findCommentByIdMock.mockResolvedValue({
      id: 'parent-1',
      postId: 42,
      deletedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(
      submitComment({
        ...baseInput,
        parentCommentId: 'parent-1',
      })
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(createCommentMock).not.toHaveBeenCalled();
  });
});
