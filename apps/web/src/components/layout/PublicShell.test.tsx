// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicNavHref } from '@/lib/constants';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock('lucide-react', () => ({
  Home: () => <span data-testid="icon-home" />,
  Layers: () => <span data-testid="icon-projects" />,
  BookOpen: () => <span data-testid="icon-blog" />,
  FileText: () => <span data-testid="icon-resume" />,
  Mail: () => <span data-testid="icon-contact" />,
  Menu: () => <span data-testid="icon-menu" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('@/components/ui/animated-shiny-text', () => ({
  AnimatedShinyText: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  SheetContent: ({
    children,
    ...rest
  }: { children: React.ReactNode } & Record<string, unknown>) => <div {...rest}>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Footer is an async server component — mock it as a simple sync component.
vi.mock('./Footer', () => ({
  Footer: () => <footer data-testid="footer">© 2026</footer>,
}));

import { PublicShell } from './PublicShell';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PublicShell', () => {
  it('renders the skip navigation link', () => {
    render(
      <PublicShell activeHref="/">
        <div>page content</div>
      </PublicShell>
    );

    const skipLink = screen.getByText('Ir para o conteúdo principal');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.closest('a')).toHaveAttribute('href', '#main-content');
  });

  it('renders the header with navigation', () => {
    render(
      <PublicShell activeHref="/">
        <div>page content</div>
      </PublicShell>
    );

    // Header should contain the brand name
    expect(screen.getByText('Gustavo Sotero')).toBeInTheDocument();

    // Desktop nav should be present — both desktop and mobile render links,
    // so we use getAllByRole and verify at least one match exists.
    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: 'Blog' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the main content area with the correct id', () => {
    render(
      <PublicShell activeHref="/blog">
        <div>blog content here</div>
      </PublicShell>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveTextContent('blog content here');
  });

  it('renders the footer', () => {
    render(
      <PublicShell activeHref="/">
        <div>page content</div>
      </PublicShell>
    );

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('passes activeHref to the header so the correct nav item is marked active', () => {
    render(
      <PublicShell activeHref="/projects">
        <div>page content</div>
      </PublicShell>
    );

    // Both desktop and mobile nav render links — check that at least one
    // Projetos link has aria-current="page".
    const projectsLinks = screen.getAllByRole('link', { name: 'Projetos' });
    expect(projectsLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);

    // Home links should not be active
    const homeLinks = screen.getAllByRole('link', { name: 'Home' });
    expect(homeLinks.every((link) => !link.hasAttribute('aria-current'))).toBe(true);
  });

  it('renders the correct active nav item for each public section', () => {
    const sections: Array<{ activeHref: PublicNavHref; label: string }> = [
      { activeHref: '/', label: 'Home' },
      { activeHref: '/projects', label: 'Projetos' },
      { activeHref: '/blog', label: 'Blog' },
      { activeHref: '/curriculo', label: 'Currículo' },
      { activeHref: '/contact', label: 'Contato' },
    ];

    for (const { activeHref, label } of sections) {
      const { unmount } = render(
        <PublicShell activeHref={activeHref}>
          <div>content</div>
        </PublicShell>
      );
      // Both desktop and mobile nav render links — verify at least one is active.
      const links = screen.getAllByRole('link', { name: label });
      expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
      unmount();
    }
  });

  it('renders header before main and main before footer in DOM order', () => {
    render(
      <PublicShell activeHref="/">
        <div>page content</div>
      </PublicShell>
    );

    const header = document.querySelector('header');
    const main = screen.getByRole('main');
    const footer = screen.getByTestId('footer');

    expect(header).not.toBeNull();
    if (header) {
      expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
