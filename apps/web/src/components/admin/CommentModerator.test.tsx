import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const updateStatusMutate = vi.fn();
const editMutate = vi.fn();
const replyMutate = vi.fn();
const deleteMutate = vi.fn();
const refetchMock = vi.fn();

vi.mock('@/hooks/admin/use-admin-comments', () => ({
  useAdminComments: vi.fn(),
  useApproveComment: () => ({ mutate: approveMutate, isPending: false }),
  useRejectComment: () => ({ mutate: rejectMutate, isPending: false }),
  useAdminUpdateCommentStatus: () => ({ mutate: updateStatusMutate, isPending: false }),
  useAdminEditCommentContent: () => ({ mutate: editMutate, isPending: false }),
  useAdminReplyComment: () => ({ mutate: replyMutate, isPending: false }),
  useAdminDeleteComment: () => ({ mutate: deleteMutate, isPending: false }),
}));

vi.mock('@/components/shared/TrustedHtml', () => ({
  TrustedHtml: ({ html }: { html: string; className?: string }) => (
    <div data-testid="trusted-html">{html}</div>
  ),
}));

import { useAdminComments } from '@/hooks/admin/use-admin-comments';
import { CommentModerator } from './CommentModerator';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeComment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'comment-1',
    postId: 42,
    postTitle: 'Test Post',
    parentCommentId: null,
    authorName: 'Alice',
    authorEmail: 'alice@example.com',
    authorRole: 'user',
    content: 'Great post!',
    renderedContent: '<p>Great post!</p>',
    status: 'pending',
    ipHash: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    moderatedAt: null,
    moderatedBy: null,
    editedAt: null,
    editedBy: null,
    editReason: null,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    ...overrides,
  };
}

function stubComments(
  comments: ReturnType<typeof makeComment>[],
  opts: { isLoading?: boolean; isError?: boolean; totalPages?: number; total?: number } = {}
) {
  (useAdminComments as ReturnType<typeof vi.fn>).mockReturnValue({
    data: {
      data: comments,
      meta: {
        page: 1,
        perPage: 10,
        total: opts.total ?? comments.length,
        totalPages: opts.totalPages ?? 1,
      },
    },
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    refetch: refetchMock,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentModerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  // ── Loading state ───────────────────────────────────────────────────────────

  it('shows skeleton placeholders while loading', () => {
    (useAdminComments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: refetchMock,
    });

    render(<CommentModerator />);

    // The skeleton renders inside the list area; the comment card content
    // should NOT be visible yet.
    expect(screen.queryByText('Alice')).toBeNull();
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  it('shows a retry button on error and calls refetch when clicked', () => {
    stubComments([], { isError: true });

    render(<CommentModerator />);

    const retryBtn = screen.getByRole('button', { name: /tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows the empty-state message when no comments are returned', () => {
    stubComments([]);

    render(<CommentModerator />);

    expect(screen.getByText(/nenhum comentário pendente/i)).toBeInTheDocument();
  });

  // ── Comment rendering ───────────────────────────────────────────────────────

  it('renders comment author name and content when data is available', () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByTestId('trusted-html')).toBeInTheDocument();
  });

  it('renders deleted comment metadata when deleted items are returned', () => {
    stubComments([
      makeComment({
        deletedAt: '2026-01-02T00:00:00.000Z',
        deletedBy: 'admin',
        deleteReason: 'spam',
      }),
    ]);

    render(<CommentModerator />);

    expect(screen.getAllByText(/excluído/i).length).toBeGreaterThan(0);
  });

  // ── Approve / Reject mutations ──────────────────────────────────────────────

  it('calls approve mutation when the Aprovar button is clicked', () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));
    expect(approveMutate).toHaveBeenCalledWith('comment-1');
  });

  it('calls reject mutation when the Rejeitar button is clicked', () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
    expect(rejectMutate).toHaveBeenCalledWith('comment-1');
  });

  // ── Dialog lifecycle — Edit ─────────────────────────────────────────────────

  it('opens the edit dialog when the Editar button is clicked', async () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/editar comentário/i)).toBeInTheDocument();
    });
  });

  it('closes the edit dialog when Cancelar is clicked', async () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));

    await waitFor(() => screen.getByRole('dialog'));

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ── Dialog lifecycle — Reply ────────────────────────────────────────────────

  it('opens the reply dialog when the Responder button is clicked', async () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /responder/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/responder como admin/i)).toBeInTheDocument();
    });
  });

  // ── Dialog lifecycle — Delete ───────────────────────────────────────────────

  it('opens the delete dialog when the Excluir button is clicked', async () => {
    stubComments([makeComment()]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/excluir comentário/i)).toBeInTheDocument();
    });
  });

  // ── Status tab filtering ────────────────────────────────────────────────────

  it('switches to the Aprovados tab when clicked', async () => {
    stubComments([]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /aprovados/i }));

    await waitFor(() => {
      expect(useAdminComments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'approved' })
      );
    });
  });

  it('toggles deleted visibility and requests deleted comments', async () => {
    stubComments([]);

    render(<CommentModerator />);

    fireEvent.click(screen.getByRole('button', { name: /ocultar excluídos/i }));

    await waitFor(() => {
      expect(useAdminComments).toHaveBeenLastCalledWith(
        expect.objectContaining({ deleted: true, status: 'pending' })
      );
    });
  });

  it('renders pagination controls and requests the next page', async () => {
    stubComments([makeComment()], { totalPages: 3, total: 25 });

    render(<CommentModerator />);

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1];
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(useAdminComments).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, perPage: 10, status: 'pending' })
      );
    });
  });
});
