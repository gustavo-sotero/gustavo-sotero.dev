import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiServerGetPaginatedMock, apiServerGetMock } = vi.hoisted(() => ({
  apiServerGetPaginatedMock: vi.fn(),
  apiServerGetMock: vi.fn(),
}));

vi.mock('@/lib/api.server', () => ({
  apiServerGetPaginated: apiServerGetPaginatedMock,
  apiServerGet: apiServerGetMock,
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

import { getResumeData } from './resume';

function makePaginatedResponse<T>(items: T[]) {
  return { data: items, meta: { page: 1, perPage: 20, total: items.length, totalPages: 1 } };
}

describe('getResumeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tags from /tags?source=project', async () => {
    apiServerGetPaginatedMock
      .mockResolvedValueOnce(makePaginatedResponse([]))
      .mockResolvedValueOnce(makePaginatedResponse([]))
      .mockResolvedValueOnce(makePaginatedResponse([]))
      .mockResolvedValueOnce(makePaginatedResponse([]));
    apiServerGetMock.mockResolvedValueOnce([]);

    await getResumeData();

    expect(apiServerGetMock).toHaveBeenCalledWith('/tags?source=project');
  });

  it('returns ok state when all sources succeed', async () => {
    apiServerGetPaginatedMock
      .mockResolvedValueOnce(makePaginatedResponse([{ id: 1, role: 'Backend Engineer' }]))
      .mockResolvedValueOnce(
        makePaginatedResponse([{ id: 2, title: 'Análise e Desenvolvimento de Sistemas' }])
      )
      .mockResolvedValueOnce(
        makePaginatedResponse([
          {
            id: 5,
            name: 'TypeScript',
            category: 'language',
            expertiseLevel: 3,
            isHighlighted: true,
          },
        ])
      )
      .mockResolvedValueOnce(makePaginatedResponse([{ id: 3, title: 'Projeto destaque' }]));
    apiServerGetMock.mockResolvedValueOnce([{ id: 4, name: 'TypeScript', category: 'language' }]);

    const result = await getResumeData();

    expect(result.state).toBe('ok');
    expect(result.data.experience.length).toBe(1);
    expect(result.data.education.length).toBe(1);
    expect(result.data.projects.length).toBe(1);
    expect(result.data.skills.length).toBe(1);
    expect(result.data.tags.length).toBe(1);
  });

  it('passes impactFacts through for experience and projects', async () => {
    apiServerGetPaginatedMock
      .mockResolvedValueOnce(
        makePaginatedResponse([
          { id: 1, role: 'Backend Engineer', impactFacts: ['Liderou equipe de 4 devs'] },
        ])
      )
      .mockResolvedValueOnce(
        makePaginatedResponse([{ id: 2, title: 'Análise e Desenvolvimento de Sistemas' }])
      )
      .mockResolvedValueOnce(makePaginatedResponse([]))
      .mockResolvedValueOnce(
        makePaginatedResponse([
          { id: 3, title: 'Projeto destaque', impactFacts: ['Reduziu latência em 40%'] },
        ])
      );
    apiServerGetMock.mockResolvedValueOnce([]);

    const result = await getResumeData();

    expect(result.state).toBe('ok');
    const exp = result.data.experience as Array<{ impactFacts: string[] }>;
    expect(exp[0]?.impactFacts).toEqual(['Liderou equipe de 4 devs']);
    const proj = result.data.projects as Array<{ impactFacts: string[] }>;
    expect(proj[0]?.impactFacts).toEqual(['Reduziu latência em 40%']);
  });

  it('returns degraded state when one source fails, preserving partial data', async () => {
    apiServerGetPaginatedMock
      .mockRejectedValueOnce(new Error('experience API down'))
      .mockResolvedValueOnce(
        makePaginatedResponse([{ id: 2, title: 'Análise e Desenvolvimento de Sistemas' }])
      )
      .mockResolvedValueOnce(makePaginatedResponse([]))
      .mockResolvedValueOnce(makePaginatedResponse([{ id: 3, title: 'Projeto destaque' }]));
    apiServerGetMock.mockResolvedValueOnce([{ id: 4, name: 'TypeScript', category: 'language' }]);

    const result = await getResumeData();

    expect(result.state).toBe('degraded');
    expect(result.data.experience).toEqual([]);
    expect(result.data.education.length).toBe(1);
    expect(result.data.projects.length).toBe(1);
    expect(result.data.tags.length).toBe(1);
  });
});
