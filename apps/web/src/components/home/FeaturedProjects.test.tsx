// @vitest-environment jsdom

import type { Project } from '@portfolio/shared/types/projects';
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

vi.mock('@/components/projects/ProjectCard', () => ({
  ProjectCard: ({ project }: { project: Project }) => (
    <div data-testid={`project-card-${project.id}`}>{project.title}</div>
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
  FolderOpen: () => <span data-testid="icon-folder-open" />,
}));

import { FeaturedProjects } from './FeaturedProjects';

function makeProject(
  overrides: Partial<Project> & Pick<Project, 'id' | 'slug' | 'title'>
): Project {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title,
    description: overrides.description ?? null,
    content: overrides.content ?? null,
    renderedContent: overrides.renderedContent ?? null,
    coverUrl: overrides.coverUrl ?? null,
    status: overrides.status ?? 'published',
    repositoryUrl: overrides.repositoryUrl ?? null,
    liveUrl: overrides.liveUrl ?? null,
    featured: overrides.featured ?? true,
    order: overrides.order ?? 0,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    impactFacts: overrides.impactFacts ?? [],
    skills: overrides.skills ?? [],
  };
}

const STUB_PROJECTS = [
  makeProject({ id: 1, slug: 'project-one', title: 'Project One' }),
  makeProject({ id: 2, slug: 'project-two', title: 'Project Two' }),
];

describe('FeaturedProjects', () => {
  it('renders two links to /projects both labelled "Ver todos os projetos"', () => {
    render(<FeaturedProjects projects={STUB_PROJECTS} />);

    // Header link + CTA carousel card — both must carry the specific label
    const links = screen.getAllByRole('link', { name: /ver todos os projetos/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/projects');
    }
  });

  it('CTA card carries an explicit aria-label that matches its visible text', () => {
    render(<FeaturedProjects projects={STUB_PROJECTS} />);

    // The CTA card is the link with an aria-label attribute — not just ambient text
    const allLinks = screen.getAllByRole('link', { name: 'Ver todos os projetos' });
    const ctaCard = allLinks.find((el) => el.hasAttribute('aria-label'));
    expect(ctaCard).toBeDefined();
    expect(ctaCard).toHaveAttribute('aria-label', 'Ver todos os projetos');
    // Visible text node inside the card also says the same thing
    expect(screen.getAllByText('Ver todos os projetos').length).toBeGreaterThanOrEqual(1);
  });

  it('renders project cards for each provided project', () => {
    render(<FeaturedProjects projects={STUB_PROJECTS} />);

    expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('project-card-2')).toBeInTheDocument();
  });
});
