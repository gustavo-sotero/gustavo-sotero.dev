// @vitest-environment jsdom

import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import { cleanup, render, screen, within } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({
  SITE_BRAND_NAME: 'Gustavo Sotero',
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

vi.mock('@/components/shared/ContactForm', () => ({
  ContactForm: () => <form data-testid="contact-form" />,
}));

vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon-file-text" />,
  Mail: () => <span data-testid="icon-mail" />,
  MapPin: () => <span data-testid="icon-mappin" />,
  Phone: () => <span data-testid="icon-phone" />,
}));

import ContactPage from './page';

afterEach(() => {
  cleanup();
});

describe('ContactPage', () => {
  it('renders the page heading', () => {
    render(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vamos conversar?');
  });

  it('shows the current availability status', () => {
    render(<ContactPage />);

    expect(screen.getByText(DEVELOPER_PUBLIC_PROFILE.availability)).toBeInTheDocument();
  });

  it('shows the 24-hour response commitment in the header status block', () => {
    render(<ContactPage />);

    const availabilityText = screen.getByText(DEVELOPER_PUBLIC_PROFILE.availability);
    const availabilityBlock = availabilityText.parentElement;

    expect(availabilityBlock).not.toBeNull();
    if (!availabilityBlock) {
      throw new Error('availability block not found');
    }

    expect(within(availabilityBlock).getByText('Resposta em até 24h')).toBeInTheDocument();
  });

  it('includes CLT/PJ messaging in the description copy', () => {
    render(<ContactPage />);

    const matches = screen.getAllByText(/CLT ou PJ/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // At least one match should be in the description paragraph (not just the status badge)
    const hasParagraphMatch = matches.some((el) => el.tagName === 'P' || el.tagName === 'SPAN');
    expect(hasParagraphMatch).toBe(true);
  });

  it('links to the curriculo page from the resume CTA', () => {
    render(<ContactPage />);

    const curriculoLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/curriculo');
    expect(curriculoLinks.length).toBeGreaterThan(0);
  });

  it('renders the contact form', () => {
    render(<ContactPage />);

    expect(screen.getByTestId('contact-form')).toBeInTheDocument();
  });
});
