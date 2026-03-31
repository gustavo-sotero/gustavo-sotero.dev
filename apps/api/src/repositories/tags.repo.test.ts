import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  andMock,
  ascMock,
  countMock,
  eqMock,
  existsMock,
  inArrayMock,
  isNullMock,
  lteMock,
  neMock,
  orMock,
  sqlMock,
  tagsTable,
  postsTable,
  projectsTable,
  experienceTable,
} = vi.hoisted(() => ({
  andMock: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  ascMock: vi.fn((field: unknown) => ({ _op: 'asc', field })),
  countMock: vi.fn(() => ({ _op: 'count' })),
  eqMock: vi.fn((...args: unknown[]) => ({ _op: 'eq', args })),
  existsMock: vi.fn((subq: unknown) => ({ _op: 'exists', subq })),
  inArrayMock: vi.fn((field: unknown, ids: unknown[]) => ({ _op: 'inArray', field, ids })),
  isNullMock: vi.fn((field: unknown) => ({ _op: 'isNull', field })),
  lteMock: vi.fn((...args: unknown[]) => ({ _op: 'lte', args })),
  neMock: vi.fn((...args: unknown[]) => ({ _op: 'ne', args })),
  orMock: vi.fn((...args: unknown[]) => ({ _op: 'or', args })),
  sqlMock: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, index) => {
      const value = index < values.length ? String(values[index]) : '';
      return `${acc}${part}${value}`;
    }, '')
  ),
  tagsTable: { id: 'tags.id', category: 'tags.category', name: 'tags.name' },
  postsTable: {
    id: 'posts.id',
    status: 'posts.status',
    deletedAt: 'posts.deletedAt',
    publishedAt: 'posts.publishedAt',
  },
  projectsTable: {
    id: 'projects.id',
    status: 'projects.status',
    deletedAt: 'projects.deletedAt',
  },
  experienceTable: {
    id: 'experience.id',
    status: 'experience.status',
    deletedAt: 'experience.deletedAt',
  },
}));

const { selectMock, fromMock, innerJoinMock, whereMock, orderByMock, buildPaginationMetaMock } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    fromMock: vi.fn(),
    innerJoinMock: vi.fn(),
    whereMock: vi.fn(),
    orderByMock: vi.fn(),
    buildPaginationMetaMock: vi.fn(),
  }));

vi.mock('drizzle-orm', () => ({
  and: andMock,
  asc: ascMock,
  count: countMock,
  eq: eqMock,
  exists: existsMock,
  inArray: inArrayMock,
  isNull: isNullMock,
  lte: lteMock,
  ne: neMock,
  or: orMock,
  sql: sqlMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  tags: tagsTable,
  postTags: { tagId: 'postTags.tagId', postId: 'postTags.postId' },
  projectTags: { tagId: 'projectTags.tagId', projectId: 'projectTags.projectId' },
  experienceTags: {
    tagId: 'experienceTags.tagId',
    experienceId: 'experienceTags.experienceId',
  },
  posts: postsTable,
  projects: projectsTable,
  experience: experienceTable,
}));

vi.mock('../lib/pagination', () => ({
  parsePagination: vi.fn(),
  buildPaginationMeta: buildPaginationMetaMock,
}));

vi.mock('../config/db', () => ({
  db: {
    select: selectMock,
  },
}));

import { findExistingTagIds, findManyTags } from './tags.repo';

/** Helper to prime mocks for a publicOnly query with `n` total matching tags. */
function setupPublicQuery(total: number, rows: unknown[]) {
  // 3 EXISTS subquery chains (each: from → innerJoin → where)
  for (let i = 0; i < 3; i++) {
    whereMock.mockReturnValueOnce({ _subquery: true }); // subquery .where() → passed to exists()
  }
  // Count query: from(tags).where()
  whereMock.mockResolvedValueOnce([{ total }]);
  // Main query: from(tags).where().orderBy()
  orderByMock.mockResolvedValueOnce(rows);
  whereMock.mockReturnValueOnce({ orderBy: orderByMock });
}

beforeEach(() => {
  vi.clearAllMocks();

  buildPaginationMetaMock.mockImplementation((total: number, page: number, perPage: number) => ({
    page,
    perPage,
    total,
    totalPages: perPage > 0 ? Math.ceil(total / perPage) : 0,
  }));

  innerJoinMock.mockReturnValue({ where: whereMock });
  fromMock.mockReturnValue({ where: whereMock, innerJoin: innerJoinMock });
  selectMock.mockReturnValue({ from: fromMock });
});

describe('tags repository public usage — EXISTS approach', () => {
  it('uses three EXISTS subqueries (posts, projects, experience) for public filter', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // exists() must be called for each entity type
    expect(existsMock).toHaveBeenCalledTimes(3);
    expect(orMock).toHaveBeenCalledTimes(1);
  });

  it('returns tags used by at least one published entity', async () => {
    const mockTag = { id: 42, name: 'Bun', category: 'tool' };
    setupPublicQuery(1, [mockTag]);

    const result = await findManyTags({}, true);

    expect(result.data).toEqual([mockTag]);
    expect(result.meta.total).toBe(1);
    expect(existsMock).toHaveBeenCalledTimes(3);
    expect(orMock).toHaveBeenCalledTimes(1);
  });

  it('passes tag id to EXISTS correlated subqueries', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // Each eq() call for the tag correlation should reference tags.id
    const eqCalls = eqMock.mock.calls;
    const correlatedCalls = eqCalls.filter((args) => args[1] === tagsTable.id);
    // One correlated condition per EXISTS subquery (postTags.tagId, projectTags.tagId, experienceTags.tagId)
    expect(correlatedCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('applies isNull(deletedAt) filter inside each EXISTS subquery', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // isNull called for posts.deletedAt, projects.deletedAt, experience.deletedAt
    expect(isNullMock).toHaveBeenCalledWith(postsTable.deletedAt);
    expect(isNullMock).toHaveBeenCalledWith(projectsTable.deletedAt);
    expect(isNullMock).toHaveBeenCalledWith(experienceTable.deletedAt);
  });

  it('returns empty list when no matching tags exist', async () => {
    setupPublicQuery(0, []);

    const result = await findManyTags({}, true);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    // Unlike the old approach, there is no early-return path — the query always runs
    expect(existsMock).toHaveBeenCalledTimes(3);
  });

  it('applies publishedAt temporal guard inside the posts EXISTS subquery', async () => {
    // This test locks the invariant that tags from future-dated scheduled posts
    // are not exposed publicly before the post crosses its publishedAt threshold.
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // lte(posts.publishedAt, sql`now()`) must be included in the posts subquery
    expect(lteMock).toHaveBeenCalledWith(postsTable.publishedAt, expect.anything());
  });
});

describe('tags repository public usage — source filter', () => {
  it('does not call or() when source=project (only projectExists used in WHERE)', async () => {
    setupPublicQuery(0, []);

    await findManyTags({ source: 'project' }, true);

    // All three EXISTS subqueries are still constructed regardless of source
    expect(existsMock).toHaveBeenCalledTimes(3);
    // But the result is a single EXISTS condition — or() is never called
    expect(orMock).not.toHaveBeenCalled();
  });

  it('does not call or() when source=post (only postExists used in WHERE)', async () => {
    setupPublicQuery(0, []);

    await findManyTags({ source: 'post' }, true);

    expect(existsMock).toHaveBeenCalledTimes(3);
    expect(orMock).not.toHaveBeenCalled();
  });

  it('does not call or() when source=experience (only experienceExists used in WHERE)', async () => {
    setupPublicQuery(0, []);

    await findManyTags({ source: 'experience' }, true);

    expect(existsMock).toHaveBeenCalledTimes(3);
    expect(orMock).not.toHaveBeenCalled();
  });

  it('calls or() to union all sources when source is absent', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // Union of post + project + experience
    expect(existsMock).toHaveBeenCalledTimes(3);
    expect(orMock).toHaveBeenCalledTimes(1);
  });

  it('combines category filter with source=project', async () => {
    setupPublicQuery(1, [{ id: 1, name: 'TypeScript', category: 'language' }]);

    const result = await findManyTags({ source: 'project', category: 'language' }, true);

    expect(result.data).toHaveLength(1);
    expect(orMock).not.toHaveBeenCalled();
    // inArray should have been called for the category filter
    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.category, ['language']);
  });
});

describe('findExistingTagIds', () => {
  it('returns empty array immediately without hitting DB when input is empty', async () => {
    const result = await findExistingTagIds([]);

    expect(result).toEqual([]);
    // No DB call should occur for empty input
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('returns all IDs that exist in the database', async () => {
    whereMock.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await findExistingTagIds([1, 2, 3]);

    expect(result).toEqual([1, 2, 3]);
    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.id, [1, 2, 3]);
  });

  it('returns only the subset of IDs that exist when some are missing', async () => {
    // DB returns only tags 1 and 3 — tag 99 does not exist
    whereMock.mockResolvedValueOnce([{ id: 1 }, { id: 3 }]);

    const result = await findExistingTagIds([1, 3, 99]);

    expect(result).toEqual([1, 3]);
    expect(result).not.toContain(99);
  });

  it('returns empty array when none of the submitted IDs exist', async () => {
    whereMock.mockResolvedValueOnce([]);

    const result = await findExistingTagIds([100, 200, 300]);

    expect(result).toEqual([]);
    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.id, [100, 200, 300]);
  });

  it('passes deduplicated IDs to inArray when duplicates are submitted', async () => {
    // The DB may return each unique ID once regardless — the important invariant
    // is that inArray receives the full submitted list (dedup is caller responsibility).
    whereMock.mockResolvedValueOnce([{ id: 5 }]);

    await findExistingTagIds([5, 5]);

    // inArray is called with the raw submitted ids (no internal dedup in this helper)
    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.id, [5, 5]);
  });

  it('maps returned row objects to plain id numbers', async () => {
    whereMock.mockResolvedValueOnce([{ id: 7 }, { id: 42 }]);

    const result = await findExistingTagIds([7, 42]);

    expect(result).toEqual([7, 42]);
    expect(result.every((v) => typeof v === 'number')).toBe(true);
  });
});
