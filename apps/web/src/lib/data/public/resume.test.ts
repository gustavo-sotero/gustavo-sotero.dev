import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import type { ResumeAggregateDTO } from '@portfolio/shared/types/resume';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiServerGetMock } = vi.hoisted(() => ({
  apiServerGetMock: vi.fn(),
}));

vi.mock('@/lib/api.server', () => ({
  apiServerGet: apiServerGetMock,
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/server-logger', () => ({
  logServerError: vi.fn(),
}));

import { getResumeData } from './resume';

const stubAggregate: ResumeAggregateDTO = {
  profile: DEVELOPER_PUBLIC_PROFILE,
  experience: [],
  education: [],
  skills: [],
  projects: [],
};

describe('getResumeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /resume exactly once', async () => {
    apiServerGetMock.mockResolvedValue(stubAggregate);

    await getResumeData();

    expect(apiServerGetMock).toHaveBeenCalledOnce();
    expect(apiServerGetMock).toHaveBeenCalledWith('/resume');
  });

  it('returns ok state when the aggregate request succeeds', async () => {
    const agg: ResumeAggregateDTO = {
      ...stubAggregate,
      experience: [{ id: 1 } as ResumeAggregateDTO['experience'][0]],
    };
    apiServerGetMock.mockResolvedValue(agg);

    const result = await getResumeData();

    expect(result.state).toBe('ok');
    expect(result.data.experience.length).toBe(1);
  });

  it('returns degraded state with empty arrays when the request fails', async () => {
    apiServerGetMock.mockRejectedValue(new Error('API unreachable'));

    const result = await getResumeData();

    expect(result.state).toBe('degraded');
    expect(result.data.experience).toEqual([]);
    expect(result.data.education).toEqual([]);
    expect(result.data.skills).toEqual([]);
    expect(result.data.projects).toEqual([]);
    expect(result.data.profile).toBeDefined();
  });

  it('includes profile in the degraded fallback', async () => {
    apiServerGetMock.mockRejectedValue(new Error('down'));

    const result = await getResumeData();

    expect(result.data.profile.name).toBe(DEVELOPER_PUBLIC_PROFILE.name);
  });

  it('passes impactFacts through for experience and projects', async () => {
    const agg: ResumeAggregateDTO = {
      ...stubAggregate,
      experience: [
        { id: 1, impactFacts: ['Liderou equipe de 4 devs'] } as ResumeAggregateDTO['experience'][0],
      ],
      projects: [
        { id: 3, impactFacts: ['Reduziu latência em 40%'] } as ResumeAggregateDTO['projects'][0],
      ],
    };
    apiServerGetMock.mockResolvedValue(agg);

    const result = await getResumeData();

    expect(result.state).toBe('ok');
    const exp = result.data.experience as Array<{ impactFacts: string[] }>;
    expect(exp[0]?.impactFacts).toEqual(['Liderou equipe de 4 devs']);
    const proj = result.data.projects as Array<{ impactFacts: string[] }>;
    expect(proj[0]?.impactFacts).toEqual(['Reduziu latência em 40%']);
  });
});
