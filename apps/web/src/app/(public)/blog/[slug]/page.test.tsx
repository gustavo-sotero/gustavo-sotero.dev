import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicPostDetailMock, notFoundMock, mockJsonLdScript, connectionMock } = vi.hoisted(
  () => ({
    getPublicPostDetailMock: vi.fn(),
    notFoundMock: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
    mockJsonLdScript: vi.fn().mockReturnValue(null),
    connectionMock: vi.fn().mockResolvedValue(undefined),
  })
);

vi.mock('@/lib/data/public/posts', () => ({
  getPublicPostDetail: (...args: unknown[]) => getPublicPostDetailMock(...args),
}));

vi.mock('@/components/blog/CommentsSection', () => ({
  CommentsSection: () => <div data-testid="comments-section" />,
}));

vi.mock('@/components/shared/JsonLdScript', () => ({
  JsonLdScript: (props: unknown) => mockJsonLdScript(props),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_API_URL: 'https://example.com/api' },
}));

vi.mock('@/components/shared/MermaidRenderer', () => ({
  MermaidRenderer: ({ html }: { html: string }) => <div data-testid="mermaid">{html}</div>,
}));

vi.mock('@/components/shared/PublicPageUnavailable', () => ({
  PublicPageUnavailable: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/shared/TechIcon', () => ({
  TechIcon: () => <span data-testid="tech-icon" />,
}));

vi.mock('@/components/shared/TrustedHtml', () => ({
  TrustedHtml: ({ html }: { html: string }) => <div data-testid="trusted-html">{html}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string; src: string }) => <div data-testid="next-image">{alt}</div>,
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('next/server', () => ({
  connection: (...args: unknown[]) => connectionMock(...args),
}));

import BlogDetailPage, { BlogDetailContent, generateMetadata } from './page';

// ── BlogDetailContent — data-fetching component (cacheComponents pattern) ────

describe('BlogDetailContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders degraded fallback when API is unavailable', async () => {
    getPublicPostDetailMock.mockResolvedValueOnce({ state: 'degraded' });

    const element = await BlogDetailContent({ params: Promise.resolve({ slug: 'post-1' }) });
    render(element as React.ReactElement);

    expect(screen.getByText(/post temporariamente indisponível/i)).toBeDefined();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('routes to not-found when the slug does not exist', async () => {
    getPublicPostDetailMock.mockResolvedValueOnce({ state: 'not-found' });

    await expect(
      BlogDetailContent({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders the post when data is available', async () => {
    getPublicPostDetailMock.mockResolvedValueOnce({
      state: 'ok',
      data: {
        id: 1,
        slug: 'post-1',
        title: 'Post 1',
        content: 'Conteudo',
        renderedContent: '<p>Conteudo</p>',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
        comments: [],
        tags: [],
      },
    });

    const element = await BlogDetailContent({ params: Promise.resolve({ slug: 'post-1' }) });
    render(element as React.ReactElement);

    expect(screen.getByText('Post 1')).toBeDefined();
    expect(screen.getByTestId('trusted-html')).toBeDefined();
    expect(screen.getByTestId('comments-section')).toBeDefined();
  });

  // ── JSON-LD URL contract ───────────────────────────────────────────────────

  it('JSON-LD url uses SITE_METADATA.url, not the API URL', async () => {
    mockJsonLdScript.mockClear();
    getPublicPostDetailMock.mockResolvedValueOnce({
      state: 'ok',
      data: {
        id: 1,
        slug: 'post-1',
        title: 'Post 1',
        content: 'Conteudo',
        renderedContent: '<p>Conteudo</p>',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
        comments: [],
        tags: [],
      },
    });

    const element = await BlogDetailContent({ params: Promise.resolve({ slug: 'post-1' }) });
    render(element as React.ReactElement);

    expect(mockJsonLdScript).toHaveBeenCalledOnce();
    const passedData = mockJsonLdScript.mock.calls[0][0].data as { url?: string };
    // The blog detail page builds JSON-LD url as `${SITE_METADATA.url}/blog/${slug}`.
    // SITE_METADATA.url is sourced from DEVELOPER_PUBLIC_PROFILE.links.website — never from
    // NEXT_PUBLIC_API_URL. This assertion guards against regressions where the API URL
    // (which may contain an /api prefix in path-based topology) bleeds into schema.org data.
    expect(passedData.url).toBe('https://gustavo-sotero.dev/blog/post-1');
    // Explicitly assert the API URL mock value does not appear in JSON-LD
    expect(passedData.url).not.toContain('example.com/api');
    expect(passedData.url).not.toContain('/api/');
  });
});

// ── BlogDetailPage — connection() contract ────────────────────────────────────────────

describe('BlogDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls connection() to opt out of PPR before rendering', async () => {
    await BlogDetailPage({ params: Promise.resolve({ slug: 'test-slug' }) });

    expect(connectionMock).toHaveBeenCalledOnce();
  });
});

// ── generateMetadata ──────────────────────────────────────────────────────────

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns degraded metadata when API is unavailable', async () => {
    getPublicPostDetailMock.mockResolvedValueOnce({ state: 'degraded' });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'post-1' }) });

    expect(metadata.title).toBe('Post temporariamente indisponível');
  });
});
