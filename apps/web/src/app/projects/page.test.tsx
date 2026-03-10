/**
 * Regression tests for ProjectsContent — the async Server Component that owns
 * the data-fetching logic for the Projects listing page.
 *
 * Key scenario (WS-F): when the API is unavailable during SSR / build,
 * ProjectsContent must return a degraded fallback instead of throwing and
 * crashing the build.
 */
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

const { mockGetPublicProjects, mockGetHomeTags } = vi.hoisted(() => ({
  mockGetPublicProjects: vi.fn(),
  mockGetHomeTags: vi.fn(),
}));

vi.mock('@/lib/data/public/projects', () => ({
  getPublicProjects: (...args: unknown[]) => mockGetPublicProjects(...args),
}));

vi.mock('@/lib/data/public/home', () => ({
  getHomeTags: (...args: unknown[]) => mockGetHomeTags(...args),
}));

vi.mock('@/components/projects/ProjectCard', () => ({
  ProjectCard: ({ project }: { project: { id: number; title: string } }) => (
    <article data-testid="project-card">{project.title}</article>
  ),
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock" />,
  Star: () => <span data-testid="icon-star" />,
}));

// ── Subject under test ────────────────────────────────────────────────────────

import { ProjectsContent } from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

const defaultMeta = { page: 1, perPage: 9, total: 2, totalPages: 1 };

describe('ProjectsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders degraded fallback when API is unavailable — build must not fail', async () => {
    mockGetPublicProjects.mockResolvedValue({ state: 'degraded' });
    mockGetHomeTags.mockResolvedValue({ state: 'degraded' });

    const element = await ProjectsContent({ currentPage: 1, sort: 'relevancia' });
    render(element as React.ReactElement);

    expect(screen.getByText(/serviço temporariamente indisponível/i)).toBeDefined();
    expect(screen.queryByTestId('project-card')).toBeNull();
  });

  it('renders normal listing when API responds with projects', async () => {
    const projects = [
      { id: 1, title: 'Project Alpha', slug: 'project-alpha' },
      { id: 2, title: 'Project Beta', slug: 'project-beta' },
    ];
    mockGetPublicProjects.mockResolvedValue({ state: 'ok', data: projects, meta: defaultMeta });
    mockGetHomeTags.mockResolvedValue({ state: 'ok', data: [] });

    const element = await ProjectsContent({ currentPage: 1, sort: 'relevancia' });
    render(element as React.ReactElement);

    expect(screen.getAllByTestId('project-card')).toHaveLength(2);
    expect(screen.getByText('Project Alpha')).toBeDefined();
    expect(screen.getByText('Project Beta')).toBeDefined();
  });

  it('renders empty state message when API returns no projects', async () => {
    mockGetPublicProjects.mockResolvedValue({
      state: 'empty',
      data: [],
      meta: { page: 1, perPage: 9, total: 0, totalPages: 0 },
    });
    mockGetHomeTags.mockResolvedValue({ state: 'empty', data: [] });

    const element = await ProjectsContent({ currentPage: 1, sort: 'relevancia' });
    render(element as React.ReactElement);

    expect(screen.getByText(/nenhum projeto encontrado/i)).toBeDefined();
    expect(screen.queryByTestId('project-card')).toBeNull();
  });

  it('does not throw when API is unavailable (simulates build-time API offline)', async () => {
    // Verify the contract: degraded state from the loader means the page resolves,
    // not throws. The network error absorption is tested in projects.test.ts.
    mockGetPublicProjects.mockResolvedValueOnce({ state: 'degraded' });
    mockGetHomeTags.mockResolvedValueOnce({ state: 'degraded' });

    await expect(ProjectsContent({ currentPage: 1, sort: 'relevancia' })).resolves.toBeDefined();
  });
});
