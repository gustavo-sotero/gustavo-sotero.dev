// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout/PublicShell', () => ({
  PublicShell: ({ activeHref, children }: { activeHref: string; children: React.ReactNode }) => (
    <div data-testid="public-shell" data-active-href={activeHref}>
      {children}
    </div>
  ),
}));

import BlogLayout from './(blog)/layout';
import ContactLayout from './(contact)/layout';
import HomeLayout from './(home)/layout';
import ProjectsLayout from './(projects)/layout';
import ResumeLayout from './(resume)/layout';

afterEach(() => {
  cleanup();
});

describe('public section layouts', () => {
  it.each([
    { Layout: HomeLayout, activeHref: '/', child: 'home child' },
    { Layout: ProjectsLayout, activeHref: '/projects', child: 'projects child' },
    { Layout: BlogLayout, activeHref: '/blog', child: 'blog child' },
    { Layout: ResumeLayout, activeHref: '/curriculo', child: 'resume child' },
    { Layout: ContactLayout, activeHref: '/contact', child: 'contact child' },
  ])('wraps children with PublicShell for $activeHref', ({ Layout, activeHref, child }) => {
    render(
      <Layout>
        <div>{child}</div>
      </Layout>
    );

    expect(screen.getByTestId('public-shell')).toHaveAttribute('data-active-href', activeHref);
    expect(screen.getByText(child)).toBeInTheDocument();
  });
});
