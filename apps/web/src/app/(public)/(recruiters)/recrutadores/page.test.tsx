// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@portfolio/shared/constants/developerProfile', () => ({
  DEVELOPER_PUBLIC_PROFILE: {
    name: 'Gustavo Sotero',
    role: 'Desenvolvedor Full Stack',
    objective: 'Desenvolvedor Full Stack com foco em TypeScript.',
    availability: 'Disponível — CLT ou PJ, remoto no Brasil',
    city: 'Aracaju',
    state: 'SE',
    contacts: { email: 'contato@gustavo-sotero.dev' },
    links: {
      website: 'https://gustavo-sotero.dev',
      github: 'https://github.com/gustavo-sotero',
      linkedin: 'https://linkedin.com/in/gustavo-sotero',
      telegram: 'https://t.me/gustavo_sotero',
      whatsapp: 'https://wa.me/5579996423943',
    },
  },
}));

vi.mock('@/lib/constants', () => ({
  SITE_BRAND_NAME: 'Gustavo Sotero',
  SITE_METADATA: { url: 'https://gustavo-sotero.dev' },
  SOCIAL_LINKS: {
    linkedin: 'https://linkedin.com/in/gustavo-sotero',
    github: 'https://github.com/gustavo-sotero',
    telegram: 'https://t.me/gustavo_sotero',
    whatsapp: 'https://wa.me/5579996423943',
    email: 'mailto:contato@gustavo-sotero.dev',
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

vi.mock('@icons-pack/react-simple-icons', () => ({
  SiTelegram: () => <span data-testid="icon-telegram" />,
  SiWhatsapp: () => <span data-testid="icon-whatsapp" />,
}));

vi.mock('@/components/shared/BrandIcons', () => ({
  GitHubIcon: () => <span data-testid="icon-github" />,
  LinkedInIcon: () => <span data-testid="icon-linkedin" />,
}));

vi.mock('lucide-react', () => ({
  Briefcase: () => <span data-testid="icon-briefcase" />,
  Building2: () => <span data-testid="icon-building2" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
  FileText: () => <span data-testid="icon-file-text" />,
  Github: () => <span data-testid="icon-github-lu" />,
  Laptop: () => <span data-testid="icon-laptop" />,
  Mail: () => <span data-testid="icon-mail" />,
  MapPin: () => <span data-testid="icon-mappin" />,
}));

import RecrutadoresPage from './page';

afterEach(() => {
  cleanup();
});

describe('RecrutadoresPage', () => {
  it('renders the page heading and availability status', () => {
    render(<RecrutadoresPage />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Disponível — CLT ou PJ/)).toBeInTheDocument();
  });

  it('shows the CLT/PJ regime availability detail', () => {
    render(<RecrutadoresPage />);

    expect(screen.getByText('CLT ou PJ')).toBeInTheDocument();
    expect(screen.getByText('100% Remoto')).toBeInTheDocument();
  });

  it('links to curriculo and contact pages', () => {
    render(<RecrutadoresPage />);

    const curriculoLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/curriculo');
    expect(curriculoLinks.length).toBeGreaterThan(0);

    const contactLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/contact');
    expect(contactLinks.length).toBeGreaterThan(0);
  });

  it('exposes the developer email as a contact link', () => {
    render(<RecrutadoresPage />);

    const emailLink = screen.getByRole('link', { name: /contato@gustavo-sotero\.dev/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:contato@gustavo-sotero.dev');
  });

  it('shows all six technical highlights', () => {
    render(<RecrutadoresPage />);

    expect(screen.getByText(/TypeScript ponta a ponta/)).toBeInTheDocument();
    expect(screen.getByText(/APIs REST documentadas/)).toBeInTheDocument();
    expect(screen.getByText(/Processamento ass\u00edncrono com filas/)).toBeInTheDocument();
    expect(screen.getByText(/Testes automatizados/)).toBeInTheDocument();
    expect(screen.getByText(/Deploy containerizado/)).toBeInTheDocument();
    expect(screen.getByText(/Projeto autoral completo/)).toBeInTheDocument();
  });
});
