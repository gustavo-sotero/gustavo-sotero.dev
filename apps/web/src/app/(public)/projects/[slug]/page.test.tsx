import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicProjectDetailMock, notFoundMock, mockJsonLdScript } = vi.hoisted(() => ({
  getPublicProjectDetailMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockJsonLdScript: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/data/public/projects', () => ({
  getPublicProjectDetail: (...args: unknown[]) => getPublicProjectDetailMock(...args),
}));

vi.mock('@/components/shared/JsonLdScript', () => ({
  JsonLdScript: (props: unknown) => mockJsonLdScript(props),
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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string; src: string }) => <div data-testid="next-image">{alt}</div>,
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_API_URL: 'https://example.com/api' },
}));

import ProjectDetailPage, { generateMetadata } from './page';

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders degraded fallback when API is unavailable', async () => {
    getPublicProjectDetailMock.mockResolvedValueOnce({ state: 'degraded' });

    const element = await ProjectDetailPage({ params: Promise.resolve({ slug: 'project-1' }) });
    render(element as React.ReactElement);

    expect(screen.getByText(/projeto temporariamente indisponível/i)).toBeDefined();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('routes to not-found when the slug does not exist', async () => {
    getPublicProjectDetailMock.mockResolvedValueOnce({ state: 'not-found' });

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders the project when data is available', async () => {
    getPublicProjectDetailMock.mockResolvedValueOnce({
      state: 'ok',
      data: {
        id: 1,
        slug: 'project-1',
        title: 'Project 1',
        description: 'Descricao',
        renderedContent: '<p>Descricao</p>',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
        tags: [],
      },
    });

    const element = await ProjectDetailPage({ params: Promise.resolve({ slug: 'project-1' }) });
    render(element as React.ReactElement);

    expect(screen.getByText('Project 1')).toBeDefined();
    expect(screen.getByTestId('trusted-html')).toBeDefined();
  });

  // ── JSON-LD URL contract ───────────────────────────────────────────────────

  it('JSON-LD url uses SITE_METADATA.url, not the API URL', async () => {
    mockJsonLdScript.mockClear();
    getPublicProjectDetailMock.mockResolvedValueOnce({
      state: 'ok',
      data: {
        id: 1,
        slug: 'project-1',
        title: 'Project 1',
        description: 'Descricao',
        renderedContent: '<p>Descricao</p>',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
        tags: [],
      },
    });

    const element = await ProjectDetailPage({ params: Promise.resolve({ slug: 'project-1' }) });
    render(element as React.ReactElement);

    expect(mockJsonLdScript).toHaveBeenCalledOnce();
    const passedData = mockJsonLdScript.mock.calls[0][0].data as { url?: string };
    // The project detail page builds JSON-LD url as `${SITE_METADATA.url}/projects/${slug}`.
    // SITE_METADATA.url is sourced from DEVELOPER_PUBLIC_PROFILE.links.website — never from
    // NEXT_PUBLIC_API_URL. This assertion guards against regressions where the API URL
    // (which may contain an /api prefix) bleeds into canonical structured data.
    expect(passedData.url).toBe('https://gustavo-sotero.dev/projects/project-1');
    // Explicitly assert the API URL mock value does not appear in JSON-LD
    expect(passedData.url).not.toContain('example.com/api');
    expect(passedData.url).not.toContain('/api/');
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns degraded metadata when API is unavailable', async () => {
    getPublicProjectDetailMock.mockResolvedValueOnce({ state: 'degraded' });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'project-1' }) });

    expect(metadata.title).toBe('Projeto temporariamente indisponível');
  });
});
