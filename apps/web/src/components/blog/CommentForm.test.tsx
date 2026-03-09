/**
 * Tests for CommentForm — comment and reply submission.
 *
 * Covers:
 *  - Default (root) mode renders "Deixe um comentário" heading
 *  - Reply mode renders reply context banner with replyingToName
 *  - Cancel reply button calls onCancelReply
 *  - On success in reply mode, shows correct success copy
 *  - parentCommentId is included in the POST payload when in reply mode
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Turnstile: trigger onSuccess after render via useEffect to avoid updating state during render
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => {
    React.useEffect(() => {
      onSuccess?.('mock-turnstile-token');
    }, [onSuccess]);
    return <div data-testid="turnstile" />;
  },
}));

const mockApiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x000000000000TEST' },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ShadcnUI components: pass-through so we can interact with normal HTML elements
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('lucide-react', () => ({
  CornerDownRight: () => <span data-testid="icon-corner" />,
  Loader2: () => <span data-testid="icon-loader" />,
  MessageCircle: () => <span data-testid="icon-message" />,
  X: () => <span data-testid="icon-x" />,
}));

import React from 'react';
import { CommentForm } from './CommentForm';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentForm', () => {
  beforeEach(() => {
    mockApiPost.mockResolvedValue({ success: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Default mode (no reply context) ─────────────────────────────────────────

  it('shows "Deixe um comentário" heading in default mode', () => {
    render(<CommentForm postId={1} />);
    expect(screen.getByText(/Deixe um comentário/i)).toBeInTheDocument();
  });

  it('does not render the reply banner in default mode', () => {
    render(<CommentForm postId={1} />);
    expect(screen.queryByText(/Respondendo a/i)).not.toBeInTheDocument();
  });

  // ── Reply mode (parentCommentId provided) ────────────────────────────────────

  it('shows reply context banner when replyingToName is provided', () => {
    render(
      <CommentForm
        postId={1}
        parentCommentId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
        replyingToName="Jane"
      />
    );
    expect(screen.getByText(/Respondendo a/i)).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('calls onCancelReply when cancel button is clicked in reply mode', () => {
    const onCancelReply = vi.fn();
    render(
      <CommentForm
        postId={1}
        parentCommentId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
        replyingToName="Bob"
        onCancelReply={onCancelReply}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar resposta/i });
    fireEvent.click(cancelBtn);

    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it('textarea shows reply placeholder when in reply mode', () => {
    render(
      <CommentForm
        postId={1}
        parentCommentId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
        replyingToName="Carla"
      />
    );
    expect(screen.getByPlaceholderText(/Escreva sua resposta/i)).toBeInTheDocument();
  });

  it('textarea shows comment placeholder in default mode', () => {
    render(<CommentForm postId={1} />);
    expect(screen.getByPlaceholderText(/Escreva seu comentário/i)).toBeInTheDocument();
  });

  // ── Form submission with parentCommentId ─────────────────────────────────────

  it('includes parentCommentId in POST payload when in reply mode', async () => {
    const parentCommentId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    mockApiPost.mockResolvedValueOnce({ success: true });

    render(<CommentForm postId={42} parentCommentId={parentCommentId} replyingToName="Carlos" />);

    // Fill out required fields
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escreva sua resposta/i), {
      target: { value: 'Esta é uma resposta válida de teste.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar|responder/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/comments',
        expect.objectContaining({
          postId: 42,
          parentCommentId,
        })
      );
    });
  });

  it('does NOT include parentCommentId when in default mode', async () => {
    mockApiPost.mockResolvedValueOnce({ success: true });

    render(<CommentForm postId={5} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escreva seu comentário/i), {
      target: { value: 'Um bom comentário de teste para submissão.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar|responder/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/comments',
        expect.not.objectContaining({ parentCommentId: expect.anything() })
      );
    });
  });

  // ── Success state copy ────────────────────────────────────────────────────────

  it('shows reply success copy after successful submission in reply mode', async () => {
    mockApiPost.mockResolvedValueOnce({ success: true });

    render(
      <CommentForm
        postId={1}
        parentCommentId="cccccccc-cccc-4ccc-cccc-cccccccccccc"
        replyingToName="Diana"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Responder' } });
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'r@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escreva sua resposta/i), {
      target: { value: 'Resposta válida do componente de teste.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar|responder/i }));

    await waitFor(() => {
      expect(screen.getByText(/Resposta enviada com sucesso!/i)).toBeInTheDocument();
    });
  });

  it('shows generic comment success copy after successful submission in default mode', async () => {
    mockApiPost.mockResolvedValueOnce({ success: true });

    render(<CommentForm postId={1} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Commenter' } });
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'c@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escreva seu comentário/i), {
      target: { value: 'Comentário válido do componente de teste.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar|responder/i }));

    await waitFor(() => {
      expect(screen.getByText(/Comentário enviado com sucesso!/i)).toBeInTheDocument();
    });
  });
});
