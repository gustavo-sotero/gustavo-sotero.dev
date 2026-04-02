// @vitest-environment jsdom

import type { Post } from '@portfolio/shared';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/blur-fade', () => ({
  BlurFade: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({
    children,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div {...rest}>{children}</div>
  ),
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselPrevious: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
  CarouselNext: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
}));

vi.mock('@/components/blog/PostCard', () => ({
  PostCard: ({ post }: { post: Post }) => (
    <div data-testid={`post-card-${post.id}`}>{post.title}</div>
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

vi.mock('lucide-react', () => ({
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  BookOpen: () => <span data-testid="icon-book-open" />,
}));

import { RecentPosts } from './RecentPosts';

function makePost(overrides: Partial<Post> & Pick<Post, 'id' | 'slug' | 'title'>): Post {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title,
    excerpt: overrides.excerpt ?? null,
    content: overrides.content ?? '',
    renderedContent: overrides.renderedContent ?? null,
    coverUrl: overrides.coverUrl ?? null,
    status: overrides.status ?? 'published',
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    publishedAt: overrides.publishedAt ?? '2026-01-01T00:00:00.000Z',
    scheduledAt: overrides.scheduledAt ?? null,
    tags: overrides.tags ?? [],
  };
}

const STUB_POSTS = [
  makePost({ id: 1, slug: 'post-one', title: 'Post One' }),
  makePost({ id: 2, slug: 'post-two', title: 'Post Two' }),
];

describe('RecentPosts', () => {
  it('renders nothing when the posts array is empty', () => {
    const { container } = render(<RecentPosts posts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders two links to /blog both labelled "Ver todos os posts"', () => {
    render(<RecentPosts posts={STUB_POSTS} />);

    // Header link + CTA carousel card — both must carry the specific label
    const links = screen.getAllByRole('link', { name: /ver todos os posts/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/blog');
    }
  });

  it('CTA card carries an explicit aria-label that matches its visible text', () => {
    render(<RecentPosts posts={STUB_POSTS} />);

    // The CTA card is the link with an aria-label attribute — not just ambient text
    const allLinks = screen.getAllByRole('link', { name: 'Ver todos os posts' });
    const ctaCard = allLinks.find((el) => el.hasAttribute('aria-label'));
    expect(ctaCard).toBeDefined();
    expect(ctaCard).toHaveAttribute('aria-label', 'Ver todos os posts');
    // Visible text node inside the card also says the same thing
    expect(screen.getAllByText('Ver todos os posts').length).toBeGreaterThanOrEqual(1);
  });

  it('renders post cards for each provided post', () => {
    render(<RecentPosts posts={STUB_POSTS} />);

    expect(screen.getByTestId('post-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('post-card-2')).toBeInTheDocument();
  });
});
