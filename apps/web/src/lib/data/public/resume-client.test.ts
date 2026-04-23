import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiGetPaginated = vi.fn();

vi.mock('@/lib/api', () => ({
  apiGetPaginated: (...args: unknown[]) => mockApiGetPaginated(...args),
}));

const { getResumeDataClient } = await import('./resume-client');

describe('getResumeDataClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the same public resume payload shape as the server resume route', async () => {
    mockApiGetPaginated
      .mockResolvedValueOnce({ data: [{ id: 1, role: 'Backend Engineer' }] })
      .mockResolvedValueOnce({ data: [{ id: 2, title: 'ADS' }] })
      .mockResolvedValueOnce({ data: [{ id: 5, name: 'TypeScript', category: 'language' }] })
      .mockResolvedValueOnce({ data: [{ id: 3, title: 'Projeto destaque' }] });

    const result = await getResumeDataClient();

    expect(mockApiGetPaginated).toHaveBeenNthCalledWith(
      1,
      '/experience?status=published&perPage=20'
    );
    expect(mockApiGetPaginated).toHaveBeenNthCalledWith(
      2,
      '/education?status=published&perPage=20'
    );
    expect(mockApiGetPaginated).toHaveBeenNthCalledWith(3, '/skills?perPage=100');
    expect(mockApiGetPaginated).toHaveBeenNthCalledWith(
      4,
      '/projects?status=published&featured=true&perPage=20'
    );
    expect(result).toEqual({
      experience: [{ id: 1, role: 'Backend Engineer' }],
      education: [{ id: 2, title: 'ADS' }],
      skills: [{ id: 5, name: 'TypeScript', category: 'language' }],
      projects: [{ id: 3, title: 'Projeto destaque' }],
    });
  });

  it('passes impactFacts through for experience and projects', async () => {
    mockApiGetPaginated
      .mockResolvedValueOnce({
        data: [{ id: 1, role: 'Backend Engineer', impactFacts: ['Liderou equipe de 4 devs'] }],
      })
      .mockResolvedValueOnce({ data: [{ id: 2, title: 'ADS' }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ id: 3, title: 'Projeto destaque', impactFacts: ['Reduziu latência em 40%'] }],
      });

    const result = await getResumeDataClient();

    expect(result.experience[0]).toMatchObject({ impactFacts: ['Liderou equipe de 4 devs'] });
    expect(result.projects[0]).toMatchObject({ impactFacts: ['Reduziu latência em 40%'] });
  });

  it('falls back to empty arrays when any public resume endpoint is unavailable', async () => {
    mockApiGetPaginated
      .mockRejectedValueOnce(new Error('experience unavailable'))
      .mockRejectedValueOnce(new Error('education unavailable'))
      .mockRejectedValueOnce(new Error('skills unavailable'))
      .mockRejectedValueOnce(new Error('projects unavailable'));

    const result = await getResumeDataClient();

    expect(result).toEqual({
      experience: [],
      education: [],
      skills: [],
      projects: [],
    });
  });
});
