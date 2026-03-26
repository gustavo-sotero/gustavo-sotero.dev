import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getHomeTagsMock, getResumeDataMock } = vi.hoisted(() => ({
  getHomeTagsMock: vi.fn(),
  getResumeDataMock: vi.fn(),
}));

vi.mock('@/lib/data/public/home', () => ({
  getHomeTags: getHomeTagsMock,
}));

vi.mock('@/lib/data/public/resume', () => ({
  getResumeData: getResumeDataMock,
}));

vi.mock('../HeroSection', () => ({
  HeroSection: () => <div data-testid="hero-section">hero</div>,
}));

import { HeroSectionWrapper } from './HeroSectionWrapper';

async function renderServerComponent(elementPromise: Promise<React.ReactNode>) {
  const element = await elementPromise;
  render(element as React.ReactElement);
}

describe('HeroSectionWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a visible degraded-state notice when any dependency fails', async () => {
    getHomeTagsMock.mockResolvedValue({ state: 'degraded' });
    getResumeDataMock.mockResolvedValue({
      state: 'ok',
      data: { experience: [], education: [], tags: [], projects: [] },
    });

    await renderServerComponent(HeroSectionWrapper());

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('does not show degraded-state notice when all dependencies are healthy', async () => {
    getHomeTagsMock.mockResolvedValue({ state: 'ok', data: [] });
    getResumeDataMock.mockResolvedValue({
      state: 'ok',
      data: { experience: [], education: [], tags: [], projects: [] },
    });

    await renderServerComponent(HeroSectionWrapper());

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.queryByText('Seção temporariamente indisponível.')).not.toBeInTheDocument();
  });
});
