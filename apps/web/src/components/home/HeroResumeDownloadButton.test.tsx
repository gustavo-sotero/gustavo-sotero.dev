// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Download: () => <span data-testid="icon-download" />,
}));

vi.mock('@/components/ui/shimmer-button', () => ({
  ShimmerButton: ({
    children,
    background: _background,
    shimmerColor: _shimmerColor,
    borderRadius: _borderRadius,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    background?: string;
    shimmerColor?: string;
    borderRadius?: string;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: { loading?: () => React.ReactNode }) => {
    return function DynamicStub() {
      return options?.loading ? options.loading() : null;
    };
  },
}));

import { HeroResumeDownloadButton } from './HeroResumeDownloadButton';

describe('HeroResumeDownloadButton', () => {
  it('renders an immediate CTA shell before any client-only PDF work starts', () => {
    render(<HeroResumeDownloadButton />);

    const button = screen.getByRole('button', { name: 'Baixar Currículo' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('icon-download')).toBeInTheDocument();
  });
});
