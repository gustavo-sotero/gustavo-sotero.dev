/**
 * Tests for PostCard — tag rendering without truncation.
 *
 * Covers:
 *  - All tags are rendered (no slice/truncation)
 *  - No "+N" overflow badge is shown
 *  - Cards with 0 tags render without the tags section
 *  - Title and date are rendered
 */
import type { Post } from '@portfolio/shared/types/posts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: intentional <img> in next/image test mock
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
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
  CalendarDays: () => <span data-testid="icon-calendar" />,
}));

vi.mock('@/components/ui/border-beam', () => ({
  BorderBeam: () => null,
}));

vi.mock('@/lib/utils', () => ({
  formatDateBR: (date: string | null | undefined) => `formatted:${date ?? ''}`,
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

import { PostCard } from './PostCard';

// ── Factory ────────────────────────────────────────────────────────────────────

function makeTag(id: number, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category: 'tool' as const,
    iconKey: null,
    isHighlighted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    slug: 'test-post',
    title: 'Test Post',
    excerpt: null,
    content: '# Hello',
    renderedContent: '<h1>Hello</h1>',
    coverUrl: null,
    status: 'published',
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    scheduledAt: null,
    order: 0,
    tags: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

afterEach(cleanup);

describe('PostCard — tag rendering', () => {
  it('renders all tags when the post has exactly 3', () => {
    const tags = [makeTag(1, 'TypeScript'), makeTag(2, 'Docker'), makeTag(3, 'Redis')];
    render(<PostCard post={makePost({ tags })} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  it('renders all tags when the post has more than 3 (e.g., 6)', () => {
    const tags = Array.from({ length: 6 }, (_, i) => makeTag(i + 1, `Tag${i + 1}`));
    render(<PostCard post={makePost({ tags })} />);
    for (const tag of tags) {
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    }
  });

  it('does NOT render "+N" overflow badge when there are more than 3 tags', () => {
    const tags = Array.from({ length: 6 }, (_, i) => makeTag(i + 1, `Tag${i + 1}`));
    render(<PostCard post={makePost({ tags })} />);
    // Any text matching +N pattern should be absent
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('renders nothing for tags section when tags array is empty', () => {
    const { container } = render(<PostCard post={makePost({ tags: [] })} />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    // tags flex container should not be present
    expect(container.querySelectorAll('[data-slot="badge"]').length).toBe(0);
  });

  it('renders the post title', () => {
    render(<PostCard post={makePost({ title: 'My Great Post' })} />);
    expect(screen.getByText('My Great Post')).toBeInTheDocument();
  });
});
