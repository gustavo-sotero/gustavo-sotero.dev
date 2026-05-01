import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listPostsMock,
  listProjectsMock,
  listSkillsMock,
  listTagsMock,
  listExperienceMock,
  listEducationMock,
} = vi.hoisted(() => ({
  listPostsMock: vi.fn(),
  listProjectsMock: vi.fn(),
  listSkillsMock: vi.fn(),
  listTagsMock: vi.fn(),
  listExperienceMock: vi.fn(),
  listEducationMock: vi.fn(),
}));

vi.mock('../../services/posts.service', () => ({
  listPosts: listPostsMock,
}));

vi.mock('../../services/projects.service', () => ({
  listProjects: listProjectsMock,
}));

vi.mock('../../services/skills.service', () => ({
  listSkills: listSkillsMock,
}));

vi.mock('../../services/tags.service', () => ({
  listTags: listTagsMock,
}));

vi.mock('../../services/experience.service', () => ({
  listExperience: listExperienceMock,
}));

vi.mock('../../services/education.service', () => ({
  listEducation: listEducationMock,
}));

import { publicHomeRouter } from './home';

describe('public home route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const emptyList = { data: [], meta: { page: 1, perPage: 10, total: 0, totalPages: 0 } };
    listPostsMock.mockResolvedValue(emptyList);
    listProjectsMock.mockResolvedValue(emptyList);
    listSkillsMock.mockResolvedValue(emptyList);
    listTagsMock.mockResolvedValue(emptyList);
    listExperienceMock.mockResolvedValue(emptyList);
    listEducationMock.mockResolvedValue(emptyList);
  });

  it('uses no-count reads for every aggregated home section', async () => {
    const app = new Hono();
    app.route('/home', publicHomeRouter);

    const response = await app.request('/home');
    const body = (await response.json()) as {
      success: boolean;
      data: Record<string, unknown[]>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(listPostsMock).toHaveBeenCalledWith({ page: 1, perPage: 3, sort: 'manual' }, false, {
      includeTotal: false,
    });
    expect(listProjectsMock).toHaveBeenCalledWith(
      { page: 1, perPage: 3, featuredFirst: true },
      false,
      { includeTotal: false }
    );
    expect(listSkillsMock).toHaveBeenCalledWith({ page: 1, perPage: 100 }, true, {
      includeTotal: false,
    });
    expect(listTagsMock).toHaveBeenCalledWith({ source: 'post' }, true, { includeTotal: false });
    expect(listExperienceMock).toHaveBeenCalledWith(
      { status: 'published', page: 1, perPage: 10 },
      false,
      { includeTotal: false }
    );
    expect(listEducationMock).toHaveBeenCalledWith(
      { status: 'published', page: 1, perPage: 10 },
      false,
      { includeTotal: false }
    );
  });
});
