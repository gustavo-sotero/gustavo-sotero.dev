/**
 * Tests for CommentList — recursive tree rendering.
 *
 * Covers:
 *  - Empty-state rendering
 *  - Root comments render with all visible fields
 *  - Admin badge shown for authorRole='admin'
 *  - Reply button calls onReply callback with correct args
 *  - Nested replies rendered recursively
 *  - Deep nesting (≥4 levels) is capped visually, but all nodes still render
 */
import type { PublicCommentNode } from '@portfolio/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Lightweight mocks ─────────────────────────────────────────────────────────

vi.mock('@/components/shared/TrustedHtml', () => ({
  TrustedHtml: ({ html }: { html: string }) => {
    // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional in test mock
    return <div data-testid="trusted-html" dangerouslySetInnerHTML={{ __html: html }} />;
  },
}));

vi.mock('@/lib/utils', () => ({
  formatDateBR: (date: string) => `formatted:${date}`,
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

// lucide-react: return named spans so we can assert icon presence without SVG complexity
vi.mock('lucide-react', () => ({
  CornerDownRight: () => <span data-testid="icon-corner-down-right" />,
  MessageCircle: () => <span data-testid="icon-message-circle" />,
  Shield: () => <span data-testid="icon-shield" />,
}));

import { CommentList } from './CommentList';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeComment(overrides: Partial<PublicCommentNode> & { id: string }): PublicCommentNode {
  return {
    postId: 1,
    parentCommentId: null,
    authorName: 'Test User',
    authorRole: 'guest',
    content: 'Hello world',
    renderedContent: '<p>Hello world</p>',
    status: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    replies: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('renders empty-state message when comment list is empty', () => {
    render(<CommentList comments={[]} />);
    expect(screen.getByTestId('icon-message-circle')).toBeInTheDocument();
    expect(screen.getByText(/nenhum comentário/i)).toBeInTheDocument();
  });

  it('does not render the list element when comments is empty', () => {
    render(<CommentList comments={[]} />);
    expect(screen.queryByRole('list', { name: /comentários/i })).not.toBeInTheDocument();
  });

  // ── Root comment rendering ──────────────────────────────────────────────────

  it('renders a root comment with author name and content', () => {
    const comment = makeComment({ id: 'c1', authorName: 'Jane Doe' });
    render(<CommentList comments={[comment]} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByTestId('trusted-html')).toBeInTheDocument();
  });

  it('formats createdAt via formatDateBR', () => {
    const comment = makeComment({ id: 'c1', createdAt: '2026-02-15T00:00:00.000Z' });
    render(<CommentList comments={[comment]} />);
    expect(screen.getByText('formatted:2026-02-15T00:00:00.000Z')).toBeInTheDocument();
  });

  it('renders multiple root comments', () => {
    const comments = [
      makeComment({ id: 'c1', authorName: 'Alice' }),
      makeComment({ id: 'c2', authorName: 'Bob' }),
      makeComment({ id: 'c3', authorName: 'Carlos' }),
    ];
    render(<CommentList comments={comments} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
  });

  // ── Admin badge ─────────────────────────────────────────────────────────────

  it('shows Shield icon and "Autor" badge for admin-role comment', () => {
    const comment = makeComment({ id: 'c1', authorRole: 'admin', authorName: 'Admin' });
    render(<CommentList comments={[comment]} />);

    expect(screen.getAllByTestId('icon-shield').length).toBeGreaterThan(0);
    expect(screen.getByText('Autor')).toBeInTheDocument();
  });

  it('does NOT show "Autor" badge for guest comments', () => {
    const comment = makeComment({ id: 'c1', authorRole: 'guest', authorName: 'Visitor' });
    render(<CommentList comments={[comment]} />);
    expect(screen.queryByText('Autor')).not.toBeInTheDocument();
  });

  // ── Reply button ────────────────────────────────────────────────────────────

  it('calls onReply with commentId and authorName when reply button clicked', () => {
    const onReply = vi.fn();
    const comment = makeComment({ id: 'reply-target', authorName: 'Reply To Me' });
    render(<CommentList comments={[comment]} onReply={onReply} />);

    const replyBtn = screen.getByRole('button', { name: /responder a reply to me/i });
    fireEvent.click(replyBtn);

    expect(onReply).toHaveBeenCalledWith('reply-target', 'Reply To Me');
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('does not render reply button when onReply is not provided', () => {
    const comment = makeComment({ id: 'c1', authorName: 'Artur' });
    render(<CommentList comments={[comment]} />);

    expect(screen.queryByRole('button', { name: /responder/i })).not.toBeInTheDocument();
  });

  // ── Recursive nesting ───────────────────────────────────────────────────────

  it('renders nested replies inside their parent', () => {
    const child = makeComment({
      id: 'child-1',
      parentCommentId: 'root-1',
      authorName: 'Child Author',
    });
    const root = makeComment({
      id: 'root-1',
      authorName: 'Root Author',
      replies: [child],
    });

    render(<CommentList comments={[root]} />);

    expect(screen.getByText('Root Author')).toBeInTheDocument();
    expect(screen.getByText('Child Author')).toBeInTheDocument();
  });

  it('renders three levels of nesting (root → child → grandchild)', () => {
    const grandchild = makeComment({
      id: 'gc-1',
      parentCommentId: 'child-1',
      authorName: 'Grandchild',
    });
    const child = makeComment({
      id: 'child-1',
      parentCommentId: 'root-1',
      authorName: 'Child',
      replies: [grandchild],
    });
    const root = makeComment({
      id: 'root-1',
      authorName: 'Root',
      replies: [child],
    });

    render(<CommentList comments={[root]} />);

    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.getByText('Grandchild')).toBeInTheDocument();
  });

  it('renders deeply nested comments (5+ levels) without crashing — depth capped at 4', () => {
    // Build depth-5 chain
    let node: PublicCommentNode = makeComment({ id: 'deep-5', authorName: 'Level 5', replies: [] });
    for (let i = 4; i >= 1; i--) {
      node = makeComment({ id: `deep-${i}`, authorName: `Level ${i}`, replies: [node] });
    }

    expect(() => render(<CommentList comments={[node]} />)).not.toThrow();

    // All nodes still appear in the DOM (visual depth is capped, not logical)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Level ${i}`)).toBeInTheDocument();
    }
  });

  // ── renderedContent is always present (schema enforces NOT NULL) ─────────────

  it('renders renderedContent as trusted HTML', () => {
    const comment = makeComment({
      id: 'c1',
      content: 'raw',
      renderedContent: '<p>rendered</p>',
    });
    render(<CommentList comments={[comment]} />);
    expect(screen.getByTestId('trusted-html').innerHTML).toBe('<p>rendered</p>');
  });
});
