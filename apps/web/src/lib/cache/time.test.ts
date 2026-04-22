import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/cache so cacheLife is a no-op in the test environment.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
}));

// Mock server-only so it does not throw in the test environment.
vi.mock('server-only', () => ({}));

// Mock @portfolio/shared to control getExperienceLabel output.
const { getExperienceLabelMock } = vi.hoisted(() => ({
  getExperienceLabelMock: vi.fn(),
}));

vi.mock('@portfolio/shared', () => ({
  DEVELOPER_PUBLIC_PROFILE: {
    careerStartDate: '2021-07-01',
  },
  getExperienceLabel: getExperienceLabelMock,
}));

import { getCachedCurrentYear, getCachedExperienceLabel } from './time';

describe('getCachedCurrentYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current calendar year', async () => {
    const year = await getCachedCurrentYear();

    expect(year).toBe(2026);
  });
});

describe('getCachedExperienceLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to getExperienceLabel with the configured career start date', async () => {
    getExperienceLabelMock.mockReturnValue('5+ anos');

    const label = await getCachedExperienceLabel();

    expect(getExperienceLabelMock).toHaveBeenCalledWith('2021-07-01');
    expect(label).toBe('5+ anos');
  });

  it('returns whatever getExperienceLabel produces', async () => {
    getExperienceLabelMock.mockReturnValue('10+ anos');

    const label = await getCachedExperienceLabel();

    expect(label).toBe('10+ anos');
  });
});
