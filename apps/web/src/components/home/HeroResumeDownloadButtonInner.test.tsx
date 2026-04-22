// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { usePDFMock, getResumeDataClientMock, buildResumeViewModelMock, updatePdfMock } = vi.hoisted(
  () => ({
    usePDFMock: vi.fn(),
    getResumeDataClientMock: vi.fn(),
    buildResumeViewModelMock: vi.fn(),
    updatePdfMock: vi.fn(),
  })
);

vi.mock('@react-pdf/renderer', () => ({
  usePDF: usePDFMock,
}));

vi.mock('lucide-react', () => ({
  Download: () => <span data-testid="icon-download" />,
  Loader2: () => <span data-testid="icon-loader" />,
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

vi.mock('@/components/resume/ResumePdfDocument', () => ({
  ResumePdfDocument: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/data/public/resume-client', () => ({
  getResumeDataClient: getResumeDataClientMock,
}));

vi.mock('@/lib/resume/mapper', () => ({
  buildResumeViewModel: buildResumeViewModelMock,
}));

import { HeroResumeDownloadButtonInner } from './HeroResumeDownloadButtonInner';

const FIXED_NOW = new Date('2026-04-22T12:34:56.000Z');

class FixedDate extends Date {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
      return;
    }

    super(args[0] as string | number | Date);
  }

  static now() {
    return FIXED_NOW.getTime();
  }
}

describe('HeroResumeDownloadButtonInner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Date', FixedDate as unknown as DateConstructor);

    usePDFMock.mockReturnValue([{ url: 'blob:resume-pdf', loading: false }, updatePdfMock]);
    getResumeDataClientMock.mockResolvedValue({
      experience: [],
      education: [],
      tags: [],
      projects: [],
    });
    buildResumeViewModelMock.mockReturnValue({ id: 'resume-vm' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates one explicit timestamp and reuses it for mapping and PDF generation', async () => {
    render(<HeroResumeDownloadButtonInner />);

    await waitFor(() => {
      expect(buildResumeViewModelMock).toHaveBeenCalledTimes(1);
    });

    const [{ now }] = buildResumeViewModelMock.mock.calls[0] as [{ now: Date }];
    expect(now).toBeInstanceOf(Date);

    const lastUsePdfCall = usePDFMock.mock.calls.at(-1) as
      | [{ document?: React.ReactElement<{ generatedAt: string; resume: unknown }> }]
      | undefined;

    expect(lastUsePdfCall?.[0].document?.props.resume).toEqual({ id: 'resume-vm' });
    expect(lastUsePdfCall?.[0].document?.props.generatedAt).toBe(
      now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    );
    expect(screen.getByRole('button', { name: 'Baixar Currículo' })).toBeInTheDocument();
  });
});
