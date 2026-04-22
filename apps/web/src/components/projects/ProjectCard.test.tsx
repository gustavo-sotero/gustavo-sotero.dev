/**
 * Tests for ProjectCard — tag rendering without truncation.
 *
 * Covers:
 *  - All tags are rendered (no slice/truncation)
 *  - No "+N" overflow badge is shown
 *  - Projects with 0 tags render without the tags section
 *  - Title and featured badge rendered correctly
 */
import type { Project } from '@portfolio/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test mock — Next.js Image stub
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
  ExternalLink: () => <span data-testid="icon-external-link" />,
  Star: () => <span data-testid="icon-star" />,
}));

vi.mock('@/components/ui/border-beam', () => ({
  BorderBeam: () => null,
}));

import { ProjectCard } from './ProjectCard';

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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'test-project',
    title: 'Test Project',
    description: 'A test project',
    content: '# Hello',
    renderedContent: '<h1>Hello</h1>',
    coverUrl: null,
    status: 'published',
    repositoryUrl: null,
    liveUrl: null,
    featured: false,
    order: 0,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    impactFacts: [],
    tags: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

afterEach(cleanup);

describe('ProjectCard — tag rendering', () => {
  it('renders all tags when the project has exactly 3', () => {
    const tags = [makeTag(1, 'TypeScript'), makeTag(2, 'Docker'), makeTag(3, 'Redis')];
    render(<ProjectCard project={makeProject({ tags })} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  it('renders all tags when the project has more than 3 (e.g., 7)', () => {
    const tags = Array.from({ length: 7 }, (_, i) => makeTag(i + 1, `Tag${i + 1}`));
    render(<ProjectCard project={makeProject({ tags })} />);
    for (const tag of tags) {
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    }
  });

  it('does NOT render "+N" overflow badge when there are more than 3 tags', () => {
    const tags = Array.from({ length: 7 }, (_, i) => makeTag(i + 1, `Tag${i + 1}`));
    render(<ProjectCard project={makeProject({ tags })} />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('renders nothing for tags section when tags array is empty', () => {
    const { container } = render(<ProjectCard project={makeProject({ tags: [] })} />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    expect(container.querySelectorAll('[data-slot="badge"]').length).toBe(0);
  });

  it('renders the project title', () => {
    render(<ProjectCard project={makeProject({ title: 'My Great Project' })} />);
    expect(screen.getByText('My Great Project')).toBeInTheDocument();
  });

  it('renders the featured badge when project.featured is true', () => {
    render(<ProjectCard project={makeProject({ featured: true })} />);
    expect(screen.getByText('Destaque')).toBeInTheDocument();
  });

  it('does not render the featured badge when project.featured is false', () => {
    render(<ProjectCard project={makeProject({ featured: false })} />);
    expect(screen.queryByText('Destaque')).toBeNull();
  });
});

describe('ProjectCard — impactFacts rendering', () => {
  it('renders impact facts when impactFacts is non-empty', () => {
    render(
      <ProjectCard
        project={makeProject({ impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'] })}
      />
    );
    expect(screen.getByText('Reduziu latência em 40%')).toBeInTheDocument();
    expect(screen.getByText('Adotado por +200 devs')).toBeInTheDocument();
  });

  it('renders all facts in order', () => {
    const facts = ['Primeiro fato', 'Segundo fato', 'Terceiro fato'];
    render(<ProjectCard project={makeProject({ impactFacts: facts })} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Primeiro fato');
    expect(items[1]?.textContent).toContain('Segundo fato');
    expect(items[2]?.textContent).toContain('Terceiro fato');
  });

  it('does not render impact facts section when impactFacts is empty', () => {
    render(<ProjectCard project={makeProject({ impactFacts: [] })} />);
    // Facts section should not be present (nothing to assert against since there is no semantic container)
    expect(screen.queryByRole('list')).toBeNull();
  });
});
