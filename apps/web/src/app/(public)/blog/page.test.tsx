/**
 * Regression tests for BlogContent — the async Server Component that owns
 * the data-fetching logic for the Blog listing page.
 *
 * Key scenario (WS-F): when the API is unavailable during SSR / build,
 * BlogContent must return a degraded fallback instead of throwing and
 * crashing the build.
 */
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

const { mockGetPublicPosts, mockGetHomeTags } = vi.hoisted(() => ({
  mockGetPublicPosts: vi.fn(),
  mockGetHomeTags: vi.fn(),
}));

vi.mock('@/lib/data/public/posts', () => ({
  getPublicPosts: (...args: unknown[]) => mockGetPublicPosts(...args),
}));

vi.mock('@/lib/data/public/home', () => ({
  getHomeTags: (...args: unknown[]) => mockGetHomeTags(...args),
}));

vi.mock('@/components/blog/PostCard', () => ({
  PostCard: ({ post }: { post: { id: number; title: string } }) => (
    <article data-testid="post-card">{post.title}</article>
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

// ── Subject under test ────────────────────────────────────────────────────────

import { BlogContent } from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

const defaultMeta = { page: 1, perPage: 9, total: 2, totalPages: 1 };

describe('BlogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders degraded fallback when API is unavailable — build must not fail', async () => {
    mockGetPublicPosts.mockResolvedValue({ state: 'degraded' });
    mockGetHomeTags.mockResolvedValue({ state: 'degraded' });

    const element = await BlogContent({ currentPage: 1 });
    render(element as React.ReactElement);

    expect(screen.getByText(/serviço temporariamente indisponível/i)).toBeDefined();
    expect(screen.queryByTestId('post-card')).toBeNull();
  });

  it('renders normal listing when API responds with posts', async () => {
    const posts = [
      { id: 1, title: 'Post Alpha', slug: 'post-alpha' },
      { id: 2, title: 'Post Beta', slug: 'post-beta' },
    ];
    mockGetPublicPosts.mockResolvedValue({ state: 'ok', data: posts, meta: defaultMeta });
    mockGetHomeTags.mockResolvedValue({ state: 'ok', data: [] });

    const element = await BlogContent({ currentPage: 1 });
    render(element as React.ReactElement);

    expect(screen.getAllByTestId('post-card')).toHaveLength(2);
    expect(screen.getByText('Post Alpha')).toBeDefined();
    expect(screen.getByText('Post Beta')).toBeDefined();
  });

  it('renders tag chips from the public tags catalog when tags are available', async () => {
    const posts = [{ id: 1, title: 'Post Alpha', slug: 'post-alpha' }];
    mockGetPublicPosts.mockResolvedValue({ state: 'ok', data: posts, meta: defaultMeta });
    mockGetHomeTags.mockResolvedValue({
      state: 'ok',
      data: [
        { id: 1, name: 'TypeScript', slug: 'typescript' },
        { id: 2, name: 'Bun', slug: 'bun' },
      ],
    });

    const element = await BlogContent({ currentPage: 1 });
    render(element as React.ReactElement);

    expect(screen.getByRole('navigation', { name: /filtrar por tecnologia/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Todos' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'TypeScript' })).toHaveAttribute(
      'href',
      '/blog?tag=typescript'
    );
    expect(screen.getByRole('link', { name: 'Bun' })).toHaveAttribute('href', '/blog?tag=bun');
  });

  it('keeps posts visible and hides tag chips when tags loader is degraded', async () => {
    const posts = [{ id: 1, title: 'Post Alpha', slug: 'post-alpha' }];
    mockGetPublicPosts.mockResolvedValue({ state: 'ok', data: posts, meta: defaultMeta });
    mockGetHomeTags.mockResolvedValue({ state: 'degraded' });

    const element = await BlogContent({ currentPage: 1 });
    render(element as React.ReactElement);

    expect(screen.getByTestId('post-card')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: /filtrar por tecnologia/i })
    ).not.toBeInTheDocument();
  });

  it('renders empty state message when API returns no posts', async () => {
    mockGetPublicPosts.mockResolvedValue({
      state: 'empty',
      data: [],
      meta: { page: 1, perPage: 9, total: 0, totalPages: 0 },
    });
    mockGetHomeTags.mockResolvedValue({ state: 'empty', data: [] });

    const element = await BlogContent({ currentPage: 1 });
    render(element as React.ReactElement);

    expect(screen.getByText(/nenhum artigo encontrado/i)).toBeDefined();
    expect(screen.queryByTestId('post-card')).toBeNull();
  });

  it('does not throw when API is unavailable (simulates build-time API offline)', async () => {
    mockGetPublicPosts.mockRejectedValue(new Error('ECONNREFUSED'));
    mockGetHomeTags.mockRejectedValue(new Error('ECONNREFUSED'));

    // The loader itself should catch and not propagate; this test verifies the contract
    // is consistent: if the loader returns degraded, the page renders gracefully.
    // (The actual network error is absorbed in getPublicPosts — tested in posts.test.ts)
    mockGetPublicPosts.mockResolvedValueOnce({ state: 'degraded' });
    mockGetHomeTags.mockResolvedValueOnce({ state: 'degraded' });

    await expect(BlogContent({ currentPage: 1 })).resolves.toBeDefined();
  });
});
