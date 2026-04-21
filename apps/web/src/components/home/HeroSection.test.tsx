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
    experienceLabel: '3+ anos',
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
  useReducedMotion: () => true,
}));

vi.mock('@icons-pack/react-simple-icons', () => ({
  SiGithub: () => <span data-testid="icon-github" />,
  SiTelegram: () => <span data-testid="icon-telegram" />,
  SiWhatsapp: () => <span data-testid="icon-whatsapp" />,
}));

vi.mock('lucide-react', () => ({
  // Used directly by HeroSection
  Mail: () => <span data-testid="icon-mail" />,
  Star: () => <span data-testid="icon-star" />,
  // Used by @/lib/constants (NAV_LINKS) which is transitively imported
  Home: () => <span data-testid="icon-home" />,
  Layers: () => <span data-testid="icon-layers" />,
  BookOpen: () => <span data-testid="icon-book-open" />,
  FileText: () => <span data-testid="icon-file-text" />,
  // Unused but included for completeness to avoid "no export" errors
  Linkedin: () => <span data-testid="icon-linkedin" />,
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

/**
 * HeroBackground is loaded via next/dynamic with ssr:false.
 * Mock the module so tests do not depend on motion internals and
 * so the deferred load path is exercised synchronously in jsdom.
 */
vi.mock('./HeroBackground', () => ({
  HeroBackground: () => <div data-testid="hero-background" />,
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

function expectBefore(a: HTMLElement, b: HTMLElement) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('HeroSection', () => {
  it('renders fallback stack badges when no tags are provided', () => {
    render(<HeroSection tags={[]} />);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Bun')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('renders all LCP-critical hero content without requiring motion entrance', () => {
    render(<HeroSection tags={[]} />);

    // Developer name is the primary LCP candidate — must be in a heading.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Gustavo Sotero');

    // Role text is the second most prominent element.
    expect(screen.getByText('Desenvolvedor Fullstack')).toBeInTheDocument();

    // Greeting and focus line complete the headline block.
    expect(screen.getByText('Ola')).toBeInTheDocument();
    expect(screen.getByText('Backend e arquitetura')).toBeInTheDocument();

    // Availability status must be visible (pulse indicator + label).
    expect(screen.getByText('Disponivel para novos projetos')).toBeInTheDocument();

    // Bio text must be present — the full static bio.
    expect(screen.getByText(/Construo APIs robustas/)).toBeInTheDocument();
  });

  it('renders the configured experience label inside the bio', () => {
    render(<HeroSection tags={[]} />);

    const label = screen.getByText(/3\+ anos/);
    expect(label).toBeInTheDocument();

    // The experience label must NOT be inside the h1 — it belongs in the bio
    // paragraph so the LCP heading element stays purely static.
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).not.toHaveTextContent('3+ anos');
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

    render(<HeroSection tags={tags} />);

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
