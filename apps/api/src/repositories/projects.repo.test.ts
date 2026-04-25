import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  andMock,
  eqMock,
  isNullMock,
  existsMock,
  countMock,
  sqlMock,
  projectsTable,
  projectSkillsTable,
  skillsTable,
} = vi.hoisted(() => ({
  andMock: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  eqMock: vi.fn((..._args: unknown[]) => ({ _op: 'eq' })),
  isNullMock: vi.fn((..._args: unknown[]) => ({ _op: 'isNull' })),
  existsMock: vi.fn((subq: unknown) => ({ _op: 'exists', subq })),
  countMock: vi.fn(() => ({ _op: 'count' })),
  sqlMock: vi.fn(() => ({ _op: 'sql' })),
  projectsTable: {
    id: 'projects.id',
    slug: 'projects.slug',
    status: 'projects.status',
    deletedAt: 'projects.deletedAt',
    featured: 'projects.featured',
    createdAt: 'projects.createdAt',
    order: 'projects.order',
  },
  projectSkillsTable: {
    projectId: 'projectSkills.projectId',
    skillId: 'projectSkills.skillId',
  },
  skillsTable: {
    id: 'skills.id',
    slug: 'skills.slug',
  },
}));

const {
  selectWhereMock,
  selectFromMock,
  dbSelectMock,
  findManyMock,
  findFirstMock,
  innerJoinMock,
  parsePaginationMock,
  buildPaginationMetaMock,
} = vi.hoisted(() => ({
  selectWhereMock: vi.fn(),
  selectFromMock: vi.fn(),
  dbSelectMock: vi.fn(),
  findManyMock: vi.fn(),
  findFirstMock: vi.fn(),
  innerJoinMock: vi.fn(),
  parsePaginationMock: vi.fn(),
  buildPaginationMetaMock: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: andMock,
  eq: eqMock,
  exists: existsMock,
  isNull: isNullMock,
  count: countMock,
  sql: sqlMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  projects: projectsTable,
  projectSkills: projectSkillsTable,
  skills: skillsTable,
}));

vi.mock('../lib/pagination', () => ({
  parsePagination: parsePaginationMock,
  buildPaginationMeta: buildPaginationMetaMock,
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    query: {
      projects: {
        findMany: findManyMock,
        findFirst: findFirstMock,
      },
    },
  },
}));

import { findManyProjects, findProjectBySlug } from './projects.repo';

beforeEach(() => {
  vi.clearAllMocks();

  parsePaginationMock.mockReturnValue({ page: 1, perPage: 20, offset: 0, limit: 20 });
  buildPaginationMetaMock.mockReturnValue({ page: 1, perPage: 20, total: 1, totalPages: 1 });

  selectWhereMock.mockResolvedValue([{ total: 1 }]);
  innerJoinMock.mockReturnValue({ where: selectWhereMock });
  selectFromMock.mockReturnValue({ where: selectWhereMock, innerJoin: innerJoinMock });
  dbSelectMock.mockReturnValue({ from: selectFromMock });

  findManyMock.mockResolvedValue([]);
  findFirstMock.mockResolvedValue(null);
});

describe('projects repository — public listing', () => {
  it('applies soft-delete filter in public mode', async () => {
    await findManyProjects({}, false);

    expect(isNullMock).toHaveBeenCalledWith(projectsTable.deletedAt);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('applies published status filter in public mode', async () => {
    await findManyProjects({}, false);

    expect(eqMock).toHaveBeenCalledWith(projectsTable.status, 'published');
  });

  it('does not apply published status filter in admin mode', async () => {
    await findManyProjects({}, true);

    const statusCalls = eqMock.mock.calls.filter((args) => args[1] === 'published');
    expect(statusCalls.length).toBe(0);
  });

  it('applies status filter in admin mode when status is provided', async () => {
    await findManyProjects({ status: 'draft' }, true);

    expect(eqMock).toHaveBeenCalledWith(projectsTable.status, 'draft');
  });

  it('still applies soft-delete filter in admin mode', async () => {
    await findManyProjects({}, true);

    expect(isNullMock).toHaveBeenCalledWith(projectsTable.deletedAt);
  });
});

describe('projects repository — skill filtering via EXISTS', () => {
  it('uses EXISTS subquery for skill filter (no in-memory ID array)', async () => {
    await findManyProjects({ skill: 'typescript' }, false);

    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('does not call exists() when no skill filter is provided', async () => {
    await findManyProjects({}, false);

    expect(existsMock).not.toHaveBeenCalled();
  });

  it('filters by skill slug inside the EXISTS subquery', async () => {
    await findManyProjects({ skill: 'postgresql' }, false);

    const eqCalls = eqMock.mock.calls;
    const skillSlugCall = eqCalls.find(
      (args) => args[0] === skillsTable.slug && args[1] === 'postgresql'
    );
    expect(skillSlugCall).toBeDefined();
  });
});

describe('projects repository — featured filter', () => {
  it('applies featured=true filter when specified', async () => {
    await findManyProjects({ featured: true }, false);

    expect(eqMock).toHaveBeenCalledWith(projectsTable.featured, true);
  });

  it('applies featured=false filter when specified', async () => {
    await findManyProjects({ featured: false }, false);

    expect(eqMock).toHaveBeenCalledWith(projectsTable.featured, false);
  });

  it('does not apply featured filter when not specified', async () => {
    await findManyProjects({}, false);

    const featuredCalls = eqMock.mock.calls.filter((args) => args[0] === projectsTable.featured);
    expect(featuredCalls.length).toBe(0);
  });
});

describe('projects repository — findProjectBySlug', () => {
  it('returns null when no project is found in public mode', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await findProjectBySlug('nonexistent', false);

    expect(result).toBeNull();
  });

  it('returns null when no project is found in admin mode', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await findProjectBySlug('nonexistent', true);

    expect(result).toBeNull();
  });

  it('applies published and soft-delete filters in public mode', async () => {
    await findProjectBySlug('my-project', false);

    expect(eqMock).toHaveBeenCalledWith(projectsTable.status, 'published');
    expect(isNullMock).toHaveBeenCalledWith(projectsTable.deletedAt);
  });

  it('applies only soft-delete filter in admin mode', async () => {
    await findProjectBySlug('my-project', true);

    expect(isNullMock).toHaveBeenCalledWith(projectsTable.deletedAt);
    const statusPublishCalls = eqMock.mock.calls.filter((args) => args[1] === 'published');
    expect(statusPublishCalls.length).toBe(0);
  });

  it('returns the project found by slug', async () => {
    const mockProject = { id: 1, slug: 'my-project', title: 'My Project' };
    findFirstMock.mockResolvedValue(mockProject);

    const result = await findProjectBySlug('my-project', false);

    expect(result).toEqual(mockProject);
  });
});
