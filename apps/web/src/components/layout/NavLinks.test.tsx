// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type PublicNavHref, resolvePublicNavLinks } from '@/lib/constants';

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

import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';

// ── NavLinks ───────────────────────────────────────────────────────────────────

describe('NavLinks', () => {
  it('renders all navigation links from the shared NAV_LINKS model', () => {
    render(<NavLinks activeHref="/" />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projetos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Currículo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contato' })).toBeInTheDocument();
  });

  it('marks the active link with aria-current="page"', () => {
    render(<NavLinks activeHref="/blog" />);

    const blogLink = screen.getByRole('link', { name: 'Blog' });
    expect(blogLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark non-active links with aria-current', () => {
    render(<NavLinks activeHref="/blog" />);

    const homeLink = screen.getByRole('link', { name: 'Home' });
    const projectsLink = screen.getByRole('link', { name: 'Projetos' });
    const resumeLink = screen.getByRole('link', { name: 'Currículo' });
    const contactLink = screen.getByRole('link', { name: 'Contato' });

    expect(homeLink).not.toHaveAttribute('aria-current');
    expect(projectsLink).not.toHaveAttribute('aria-current');
    expect(resumeLink).not.toHaveAttribute('aria-current');
    expect(contactLink).not.toHaveAttribute('aria-current');
  });

  it('marks the correct link for each public section', () => {
    const sections: Array<{ activeHref: PublicNavHref; label: string }> = [
      { activeHref: '/', label: 'Home' },
      { activeHref: '/projects', label: 'Projetos' },
      { activeHref: '/blog', label: 'Blog' },
      { activeHref: '/curriculo', label: 'Currículo' },
      { activeHref: '/contact', label: 'Contato' },
    ];

    for (const { activeHref, label } of sections) {
      const { unmount } = render(<NavLinks activeHref={activeHref} />);
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });
});

// ── MobileNav ─────────────────────────────────────────────────────────────────

describe('MobileNav', () => {
  it('renders the same set of navigation destinations as NavLinks', () => {
    render(<MobileNav activeHref="/" />);

    // MobileNav must expose links to every destination in the shared NAV_LINKS model.
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projetos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Currículo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contato' })).toBeInTheDocument();
  });

  it('marks the active link with aria-current="page"', () => {
    render(<MobileNav activeHref="/projects" />);

    const projectsLink = screen.getByRole('link', { name: 'Projetos' });
    expect(projectsLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark non-active links with aria-current', () => {
    render(<MobileNav activeHref="/projects" />);

    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).not.toHaveAttribute('aria-current');
  });
});

// ── Parity: desktop and mobile share one data source ─────────────────────────

describe('NavLinks / MobileNav parity', () => {
  it('resolves public nav items from one shared active-state helper', () => {
    expect(resolvePublicNavLinks('/blog')).toEqual([
      expect.objectContaining({ href: '/', isActive: false }),
      expect.objectContaining({ href: '/projects', isActive: false }),
      expect.objectContaining({ href: '/blog', isActive: true }),
      expect.objectContaining({ href: '/curriculo', isActive: false }),
      expect.objectContaining({ href: '/contact', isActive: false }),
    ]);
  });

  it('desktop and mobile expose exactly the same hrefs and labels', () => {
    const { unmount: unmountDesktop, getAllByRole: getDesktopLinks } = render(
      <NavLinks activeHref="/" />
    );
    const desktopEntries = getDesktopLinks('link').map((a) => ({
      label: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }));
    unmountDesktop();

    const { getAllByRole: getMobileLinks } = render(<MobileNav activeHref="/" />);
    const mobileEntries = getMobileLinks('link').map((a) => ({
      label: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }));

    expect(desktopEntries).toEqual(mobileEntries);
  });
});
