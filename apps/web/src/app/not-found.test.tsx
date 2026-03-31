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

// ── Subject under test ────────────────────────────────────────────────────────

import NotFound from './not-found';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotFound (root)', () => {
  it('renders "Página não encontrada" heading', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: /página não encontrada/i })).toBeDefined();
  });

  it('shows the 404 code', () => {
    render(<NotFound />);

    expect(screen.getByText('404')).toBeDefined();
  });

  it('has a link back to the home page', () => {
    render(<NotFound />);

    const link = screen.getByRole('link', { name: /voltar para o início/i });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).href).toContain('/');
  });

  it('shows the terminal comment with the kicker', () => {
    render(<NotFound />);

    expect(screen.getByText('// Error: 404 Not Found')).toBeDefined();
  });
});
