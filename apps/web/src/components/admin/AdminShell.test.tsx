/**
 * Navigation-level coverage for AdminShell.
 *
 * Asserts that /admin/uploads is declared in the admin sidebar navigation.
 * This provides a regression guard: if the NAV_ITEMS list is accidentally
 * modified to remove the uploads route, this test fails before it reaches CI.
 */

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

vi.mock('@/hooks/admin/use-admin-auth', () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

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

vi.mock('lucide-react', () => {
  const MockIcon = () => <span />;
  return {
    BarChart3: MockIcon,
    BookOpen: MockIcon,
    Bot: MockIcon,
    Briefcase: MockIcon,
    ChevronRight: MockIcon,
    GraduationCap: MockIcon,
    ImageIcon: MockIcon,
    LayoutDashboard: MockIcon,
    LogOut: MockIcon,
    MessageSquare: MockIcon,
    PanelLeftClose: MockIcon,
    PanelLeftOpen: MockIcon,
    Tag: MockIcon,
    Terminal: MockIcon,
  };
});

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ asChild: _, ...props }: { asChild?: boolean; children: React.ReactNode }) => (
    <>{props.children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminShell navigation', () => {
  it('renders a link to /admin/uploads', () => {
    render(<AdminShell>content</AdminShell>);

    const link = screen.getByRole('link', { name: /uploads/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/uploads');
  });

  it('renders links to all expected top-level admin routes', () => {
    render(<AdminShell>content</AdminShell>);

    // Collect all hrefs rendered by the nav — admin sidebar must include each of these.
    const renderedHrefs = screen.getAllByRole('link').map((el) => el.getAttribute('href'));

    const requiredHrefs = [
      '/admin/uploads',
      '/admin/posts',
      '/admin/projects',
      '/admin/analytics',
      '/admin/tags',
      '/admin/comments',
    ];

    for (const href of requiredHrefs) {
      expect(renderedHrefs).toContain(href);
    }
  });
});
