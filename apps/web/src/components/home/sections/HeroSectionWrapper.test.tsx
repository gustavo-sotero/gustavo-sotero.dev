import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getHomeTagsMock } = vi.hoisted(() => ({
  getHomeTagsMock: vi.fn(),
}));

const { heroSectionMock } = vi.hoisted(() => ({
  heroSectionMock: vi.fn(),
}));

vi.mock('@/lib/data/public/home', () => ({
  getHomeTags: getHomeTagsMock,
}));

// `getCachedExperienceLabel` uses `cacheLife()` which is a Next.js build-time
// feature not available in the Vitest jsdom environment. Mock the whole module
// so tests run without requiring the cacheComponents build config.
vi.mock('@/lib/cache/time', () => ({
  getCachedExperienceLabel: vi.fn().mockResolvedValue('4+ anos'),
  getCachedCurrentYear: vi.fn().mockResolvedValue(2026),
}));

vi.mock('../HeroSection', () => ({
  HeroSection: (props: { experienceLabel: string }) => {
    heroSectionMock(props);
    return <div data-testid="hero-section">{props.experienceLabel}</div>;
  },
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

  it('shows a visible degraded-state notice when tags dependency is degraded', async () => {
    getHomeTagsMock.mockResolvedValue({ state: 'degraded' });

    await renderServerComponent(HeroSectionWrapper());

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('does not show degraded-state notice when all dependencies are healthy', async () => {
    getHomeTagsMock.mockResolvedValue({ state: 'ok', data: [] });

    await renderServerComponent(HeroSectionWrapper());

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.queryByText('Seção temporariamente indisponível.')).not.toBeInTheDocument();
  });

  it('supplies experience label from the cache-safe server helper', async () => {
    const { getCachedExperienceLabel } = await import('@/lib/cache/time');
    (getCachedExperienceLabel as ReturnType<typeof vi.fn>).mockResolvedValue('5+ anos');
    getHomeTagsMock.mockResolvedValue({ state: 'ok', data: [] });

    await renderServerComponent(HeroSectionWrapper());

    // The wrapper must call the cache helper to obtain the experience label.
    expect(getCachedExperienceLabel).toHaveBeenCalled();
    expect(heroSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ experienceLabel: '5+ anos' })
    );
    expect(screen.getByText('5+ anos')).toBeInTheDocument();
  });
});
