import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listSkillsMock } = vi.hoisted(() => ({
  listSkillsMock: vi.fn(),
}));

vi.mock('../../services/skills.service', () => ({
  listSkills: listSkillsMock,
}));

import { publicSkillsRouter } from './skills';

const mockMeta = { page: 1, perPage: 20, total: 2, totalPages: 1 };
const mockSkills = [
  {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'language',
    iconKey: 'si:SiTypescript',
    expertiseLevel: 3,
    isHighlighted: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Hono',
    slug: 'hono',
    category: 'framework',
    iconKey: null,
    expertiseLevel: 2,
    isHighlighted: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('GET /skills (public)', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/skills', publicSkillsRouter);
  });

  it('returns 200 with paginated skill list', async () => {
    listSkillsMock.mockResolvedValueOnce({ data: mockSkills, meta: mockMeta });

    const response = await app.request('/skills');
    const body = (await response.json()) as {
      success: boolean;
      data: typeof mockSkills;
      meta: typeof mockMeta;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
  });

  it('passes category filter to service', async () => {
    listSkillsMock.mockResolvedValueOnce({
      data: [mockSkills[0]],
      meta: { ...mockMeta, total: 1, totalPages: 1 },
    });

    await app.request('/skills?category=language');

    expect(listSkillsMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'language' }),
      true,
      { includeTotal: false }
    );
  });

  it('passes highlighted filter to service', async () => {
    listSkillsMock.mockResolvedValueOnce({
      data: [mockSkills[0]],
      meta: { ...mockMeta, total: 1, totalPages: 1 },
    });

    await app.request('/skills?highlighted=true');

    expect(listSkillsMock).toHaveBeenCalledWith(
      expect.objectContaining({ highlighted: true }),
      true,
      { includeTotal: false }
    );
  });

  it('passes pagination params to service', async () => {
    listSkillsMock.mockResolvedValueOnce({ data: mockSkills, meta: mockMeta });

    await app.request('/skills?page=2&perPage=10');

    expect(listSkillsMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 10 }),
      true,
      { includeTotal: false }
    );
  });

  it('returns 400 on invalid query params', async () => {
    const response = await app.request('/skills?perPage=9999');
    expect(response.status).toBe(400);
  });
});
