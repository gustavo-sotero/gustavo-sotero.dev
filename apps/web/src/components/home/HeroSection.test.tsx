// @vitest-environment jsdom

import type { Tag } from '@portfolio/shared';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@portfolio/shared', () => ({
  DEVELOPER_PUBLIC_PROFILE: {
    name: 'Gustavo Sotero',
    role: 'Desenvolvedor Fullstack',
    bio: 'Construo APIs robustas.',
    bioShort: 'Especialista em backend TypeScript.',
    availability: 'Disponivel para novos projetos',
    hero: {
      greeting: 'Ola',
      focus: 'Backend e arquitetura',
    },
    links: {
      website: 'https://gustavo-sotero.dev',
      github: 'https://github.com/gustavo-sotero',
      linkedin: 'https://linkedin.com/in/gustavo-sotero',
      telegram: 'https://t.me/gustavo',
      whatsapp: 'https://wa.me/5511999999999',
    },
    contacts: {
      email: 'gustavo@example.com',
    },
  },
  getExperienceLabel: () => '3+ anos',
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

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => true,
}));

vi.mock('@icons-pack/react-simple-icons', () => ({
  SiGithub: () => <span data-testid="icon-github" />,
  SiTelegram: () => <span data-testid="icon-telegram" />,
  SiWhatsapp: () => <span data-testid="icon-whatsapp" />,
}));

vi.mock('lucide-react', () => ({
  Linkedin: () => <span data-testid="icon-linkedin" />,
  Mail: () => <span data-testid="icon-mail" />,
  Star: () => <span data-testid="icon-star" />,
}));

vi.mock('@/components/ui/animated-gradient-text', () => ({
  AnimatedGradientText: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/animated-grid-pattern', () => ({
  AnimatedGridPattern: () => <div data-testid="animated-grid" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    children: React.ReactNode;
  }) => (asChild ? children : <button {...props}>{children}</button>),
}));

vi.mock('@/components/ui/marquee', () => ({
  Marquee: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/resume/mapper', () => ({
  buildResumeViewModel: () => ({
    profile: {
      name: 'Gustavo Sotero',
    },
  }),
}));

vi.mock('./HeroResumeDownloadButton', () => ({
  HeroResumeDownloadButton: () => <button type="button">Baixar CV</button>,
}));

vi.mock('./HeroTerminal', () => ({
  HeroTerminal: () => <div data-testid="hero-terminal" />,
}));

import { HeroSection } from './HeroSection';

function makeTag(overrides: Partial<Tag> & Pick<Tag, 'id' | 'name' | 'category'>): Tag {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.name.toLowerCase().replace(/\s+/g, '-'),
    category: overrides.category,
    iconKey: overrides.iconKey ?? null,
    isHighlighted: overrides.isHighlighted ?? false,
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
  };
}

function makeResumeData() {
  return {
    experience: [],
    education: [],
    tags: [],
    projects: [],
  };
}

function expectBefore(a: HTMLElement, b: HTMLElement) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('HeroSection', () => {
  it('renders fallback stack badges when no tags are provided', () => {
    render(<HeroSection tags={[]} resumeData={makeResumeData()} />);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Bun')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('orders stack badges with highlighted tags first and then by category priority', () => {
    const tags: Tag[] = [
      makeTag({ id: 1, name: 'Redis', category: 'db', isHighlighted: false }),
      makeTag({ id: 2, name: 'Docker', category: 'infra', isHighlighted: true }),
      makeTag({ id: 3, name: 'TypeScript', category: 'language', isHighlighted: true }),
      makeTag({ id: 4, name: 'Bun', category: 'tool', isHighlighted: false }),
      makeTag({ id: 5, name: 'Next.js', category: 'framework', isHighlighted: false }),
      makeTag({ id: 6, name: 'AWS', category: 'cloud', isHighlighted: false }),
    ];

    render(<HeroSection tags={tags} resumeData={makeResumeData()} />);

    const typeScript = screen.getByText('TypeScript');
    const docker = screen.getByText('Docker');
    const next = screen.getByText('Next.js');
    const bun = screen.getByText('Bun');
    const redis = screen.getByText('Redis');

    expectBefore(typeScript, docker);
    expectBefore(docker, next);
    expectBefore(next, bun);
    expectBefore(bun, redis);

    // Only top 5 badges are shown.
    expect(screen.queryByText('AWS')).not.toBeInTheDocument();
  });
});
