// @vitest-environment jsdom

import type { Skill } from '@portfolio/shared';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Star: () => <span data-testid="icon-star" />,
}));

vi.mock('@/components/shared/TechIcon', () => ({
  TechIcon: ({ name }: { name: string }) => <span data-testid={`tech-icon-${name}`} />,
}));

vi.mock('@/components/ui/bento-grid', () => ({
  BentoGrid: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="bento-grid" className={className}>
      {children}
    </div>
  ),
}));

import { SkillsBentoBox } from './SkillsBentoBox';

function makeSkill(overrides: Partial<Skill> & Pick<Skill, 'id' | 'name' | 'category'>): Skill {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.name.toLowerCase().replace(/\s+/g, '-'),
    category: overrides.category,
    iconKey: overrides.iconKey ?? null,
    isHighlighted: overrides.isHighlighted ?? false,
    expertiseLevel: overrides.expertiseLevel ?? 1,
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
  };
}

function expectBefore(a: HTMLElement, b: HTMLElement) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('SkillsBentoBox', () => {
  it('returns null when there are no skills', () => {
    const { container } = render(<SkillsBentoBox skills={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders categories and their skills from the provided catalog', () => {
    const skills: Skill[] = [
      makeSkill({ id: 1, name: 'TypeScript', category: 'language', isHighlighted: true }),
      makeSkill({ id: 2, name: 'JavaScript', category: 'language' }),
      makeSkill({ id: 3, name: 'Next.js', category: 'framework' }),
      makeSkill({ id: 4, name: 'PostgreSQL', category: 'db' }),
    ];

    render(<SkillsBentoBox skills={skills} />);

    expect(screen.getByText('Stack & Skills')).toBeInTheDocument();
    expect(screen.getAllByText('Linguagem').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Framework').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Banco de dados').length).toBeGreaterThan(0);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
  });

  it('renders highlighted skills with a badge', () => {
    const skills: Skill[] = [
      makeSkill({ id: 1, name: 'JavaScript', category: 'language', isHighlighted: false }),
      makeSkill({ id: 2, name: 'TypeScript', category: 'language', isHighlighted: true }),
      makeSkill({ id: 3, name: 'Bun', category: 'tool', isHighlighted: false }),
      makeSkill({ id: 4, name: 'Docker', category: 'tool', isHighlighted: true }),
    ];

    render(<SkillsBentoBox skills={skills} />);

    const typeScript = screen.getByText('TypeScript');
    const javaScript = screen.getByText('JavaScript');
    const docker = screen.getByText('Docker');
    const bun = screen.getByText('Bun');

    expectBefore(typeScript, javaScript);
    expectBefore(docker, bun);

    // Highlight badge is rendered for highlighted items.
    expect(screen.getAllByText('Destaque')).toHaveLength(2);
  });
});
