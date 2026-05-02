import type { PublicCommentNode } from '@portfolio/shared/types/comments';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerRefreshMock = vi.fn();
const apiGetPaginatedMock = vi.fn();
const commentListRenderMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

vi.mock('@/lib/api', () => ({
  apiGetPaginated: (...args: unknown[]) => apiGetPaginatedMock(...args),
}));

vi.mock('../ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('./CommentForm', () => ({
  CommentForm: () => <div data-testid="comment-form" />,
}));

vi.mock('./CommentList', () => ({
  CommentList: (props: { comments: PublicCommentNode[] }) => {
    commentListRenderMock(props.comments);
    return <div data-testid="comment-list" />;
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="icon-loader" />,
  MessageCircle: () => <span data-testid="icon-message-circle" />,
}));

import { CommentsSection } from './CommentsSection';

function makeComment(
  id: string,
  createdAt: string,
  overrides: Partial<PublicCommentNode> = {}
): PublicCommentNode {
  return {
    id,
    postId: 1,
    parentCommentId: null,
    authorName: `Author ${id}`,
    authorRole: 'guest',
    content: `Comment ${id}`,
    renderedContent: `<p>Comment ${id}</p>`,
    status: 'approved',
    createdAt,
    replies: [],
    ...overrides,
  };
}

describe('CommentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('merges overlapping pages without duplicating comments and reattaches replies to already loaded parents', async () => {
    const initialComments = Array.from({ length: 28 }, (_, index) =>
      makeComment(`seed-${index + 1}`, `2026-05-01T00:${String(index).padStart(2, '0')}:00.000Z`)
    );
    const parent = makeComment('parent', '2026-05-01T00:28:00.000Z', { authorName: 'Parent' });
    const overlappingRoot = makeComment('overlap-root', '2026-05-01T00:29:00.000Z', {
      authorName: 'Overlap Root',
    });

    apiGetPaginatedMock.mockResolvedValueOnce({
      success: true,
      data: [
        makeComment('overlap-root', '2026-05-01T00:29:00.000Z', {
          authorName: 'Overlap Root',
        }),
        makeComment('reply-31', '2026-05-01T00:30:00.000Z', {
          parentCommentId: 'parent',
          authorName: 'Reply 31',
        }),
      ],
      meta: {
        page: 2,
        perPage: 20,
        total: 31,
        totalPages: 2,
      },
    });

    render(
      <CommentsSection
        postId={1}
        postSlug="post-slug"
        initialComments={[...initialComments, parent, overlappingRoot]}
        commentCount={31}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /carregar mais comentários/i }));

    await waitFor(() => {
      expect(apiGetPaginatedMock).toHaveBeenCalledWith(
        '/posts/post-slug/comments?page=2&perPage=20'
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /carregar mais comentários/i })
      ).not.toBeInTheDocument();
    });

    const latestComments = commentListRenderMock.mock.lastCall?.[0] as PublicCommentNode[];
    const mergedParent = latestComments.find((comment) => comment.id === 'parent');
    const overlapCount = latestComments.filter((comment) => comment.id === 'overlap-root').length;

    expect(overlapCount).toBe(1);
    expect(mergedParent?.replies).toHaveLength(1);
    expect(mergedParent?.replies[0]?.id).toBe('reply-31');
  });
});
