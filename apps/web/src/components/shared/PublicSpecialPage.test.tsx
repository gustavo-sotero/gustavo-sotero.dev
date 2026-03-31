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

import { PublicSpecialPage } from './PublicSpecialPage';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PublicSpecialPage', () => {
  it('renders title and description', () => {
    render(
      <PublicSpecialPage
        title="Página não encontrada"
        description="Esta rota não existe."
        action={null}
      />
    );

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeDefined();
    expect(screen.getByText('Esta rota não existe.')).toBeDefined();
  });

  it('renders code as large display text', () => {
    render(<PublicSpecialPage code="404" title="Not found" description="Lost." action={null} />);

    expect(screen.getByText('404')).toBeDefined();
  });

  it('renders default kicker from code in terminal comment', () => {
    render(<PublicSpecialPage code="404" title="Title" description="Desc" action={null} />);

    expect(screen.getByText('// Error: 404')).toBeDefined();
  });

  it('renders explicit kicker in terminal comment', () => {
    render(
      <PublicSpecialPage
        code="404"
        kicker="404 Not Found"
        title="Title"
        description="Desc"
        action={null}
      />
    );

    expect(screen.getByText('// Error: 404 Not Found')).toBeDefined();
  });

  it('renders icon when no code is provided', () => {
    render(
      <PublicSpecialPage
        icon={<svg data-testid="test-icon" />}
        title="Error"
        description="Something went wrong."
        action={null}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeDefined();
  });

  it('does not render icon container when code is provided', () => {
    render(
      <PublicSpecialPage
        code="404"
        icon={<svg data-testid="should-not-render" />}
        title="Title"
        description="Desc"
        action={null}
      />
    );

    expect(screen.queryByTestId('should-not-render')).toBeNull();
  });

  it('renders heading as h1 by default', () => {
    render(<PublicSpecialPage title="Main heading" description="desc" action={null} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Main heading' })).toBeDefined();
  });

  it('renders heading as h2 when headingLevel is 2', () => {
    render(
      <PublicSpecialPage title="Error heading" description="desc" action={null} headingLevel={2} />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Error heading' })).toBeDefined();
  });

  it('renders the action slot', () => {
    render(
      <PublicSpecialPage
        title="Title"
        description="Desc"
        action={
          <button type="button" data-testid="test-cta">
            Click me
          </button>
        }
      />
    );

    expect(screen.getByTestId('test-cta')).toBeDefined();
  });

  it('renders fallback kicker when no code or kicker provided', () => {
    render(<PublicSpecialPage title="Title" description="Desc" action={null} />);

    expect(screen.getByText('// Erro inesperado')).toBeDefined();
  });
});
