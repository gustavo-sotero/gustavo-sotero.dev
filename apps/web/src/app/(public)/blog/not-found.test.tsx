import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    onClick,
    className: _c,
    variant: _v,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: string }) =>
    asChild ? (
      children
    ) : (
      <button type="button" onClick={onClick} {...rest}>
        {children}
      </button>
    ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
}));

// ── Subject under test ────────────────────────────────────────────────────────

import BlogNotFound from './not-found';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BlogNotFound', () => {
  it('renders "Post não encontrado" heading', () => {
    render(<BlogNotFound />);

    expect(screen.getByRole('heading', { name: /post não encontrado/i })).toBeDefined();
  });

  it('shows the 404 code', () => {
    render(<BlogNotFound />);

    expect(screen.getByText('404')).toBeDefined();
  });

  it('has a back link to /blog', () => {
    render(<BlogNotFound />);

    const link = screen.getByRole('link', { name: /voltar para o blog/i });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe('/blog');
  });

  it('shows the contextual kicker in the terminal comment', () => {
    render(<BlogNotFound />);

    expect(screen.getByText('// Error: Post Not Found')).toBeDefined();
  });
});
