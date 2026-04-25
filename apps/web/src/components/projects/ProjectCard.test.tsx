// @vitest-environment jsdom

/**
 * Tests for ProjectCard — skill rendering without truncation.
 *
 * Covers:
 *  - All skills are rendered (no slice/truncation)
 *  - No "+N" overflow badge is shown
 *  - Projects with 0 skills render without the skills section
 *  - Title and featured badge rendered correctly
 */
import type { Project, Skill } from '@portfolio/shared';
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

function makeSkill(id: number, name: string): Skill {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category: 'tool' as const,
    iconKey: null,
    expertiseLevel: 1,
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
    skills: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

afterEach(cleanup);

describe('ProjectCard — skill rendering', () => {
  it('renders all skills when the project has exactly 3', () => {
    const skills = [makeSkill(1, 'TypeScript'), makeSkill(2, 'Docker'), makeSkill(3, 'Redis')];
    render(<ProjectCard project={makeProject({ skills })} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  it('renders all skills when the project has more than 3 (e.g., 7)', () => {
    const skills = Array.from({ length: 7 }, (_, i) => makeSkill(i + 1, `Skill${i + 1}`));
    render(<ProjectCard project={makeProject({ skills })} />);
    for (const skill of skills) {
      expect(screen.getByText(skill.name)).toBeInTheDocument();
    }
  });

  it('does NOT render "+N" overflow badge when there are more than 3 skills', () => {
    const skills = Array.from({ length: 7 }, (_, i) => makeSkill(i + 1, `Skill${i + 1}`));
    render(<ProjectCard project={makeProject({ skills })} />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('renders nothing for skills section when skills array is empty', () => {
    const { container } = render(<ProjectCard project={makeProject({ skills: [] })} />);
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
