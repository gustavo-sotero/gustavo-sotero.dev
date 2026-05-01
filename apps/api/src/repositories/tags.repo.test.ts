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
  sqlMock,
  tagsTable,
  postsTable,
} = vi.hoisted(() => ({
  andMock: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  ascMock: vi.fn((field: unknown) => ({ _op: 'asc', field })),
  countMock: vi.fn(() => ({ _op: 'count' })),
  eqMock: vi.fn((...args: unknown[]) => ({ _op: 'eq', args })),
  existsMock: vi.fn((subq: unknown) => ({ _op: 'exists', subq })),
  inArrayMock: vi.fn((field: unknown, ids: unknown[]) => ({ _op: 'inArray', field, ids })),
  isNullMock: vi.fn((field: unknown) => ({ _op: 'isNull', field })),
  lteMock: vi.fn((...args: unknown[]) => ({ _op: 'lte', args })),
  sqlMock: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, index) => {
      const value = index < values.length ? String(values[index]) : '';
      return `${acc}${part}${value}`;
    }, '')
  ),
  tagsTable: { id: 'tags.id', category: 'tags.category', name: 'tags.name', slug: 'tags.slug' },
  postsTable: {
    id: 'posts.id',
    status: 'posts.status',
    deletedAt: 'posts.deletedAt',
    publishedAt: 'posts.publishedAt',
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
  sql: sqlMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  tags: tagsTable,
  postTags: { tagId: 'postTags.tagId', postId: 'postTags.postId' },
  posts: postsTable,
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

import {
  findAllTagsForNormalization,
  findExistingTagIds,
  findManyTags,
  findTagsBySlugs,
} from './tags.repo';

/** Helper to prime mocks for a publicOnly query with `n` total matching tags. */
function setupPublicQuery(total: number, rows: unknown[]) {
  // 1 EXISTS subquery chain: postTags → innerJoin(posts) → where()
  whereMock.mockReturnValueOnce({ _subquery: true }); // subquery .where() → passed to exists()
  // Main query: from(tags).where().orderBy()
  orderByMock.mockResolvedValueOnce(rows);
  whereMock.mockReturnValueOnce({ orderBy: orderByMock });
  // Count query: from(tags).where()
  whereMock.mockResolvedValueOnce([{ total }]);
}

beforeEach(() => {
  andMock.mockClear();
  ascMock.mockClear();
  countMock.mockClear();
  eqMock.mockClear();
  existsMock.mockClear();
  inArrayMock.mockClear();
  isNullMock.mockClear();
  lteMock.mockClear();
  sqlMock.mockClear();
  selectMock.mockReset();
  fromMock.mockReset();
  innerJoinMock.mockReset();
  whereMock.mockReset();
  orderByMock.mockReset();
  buildPaginationMetaMock.mockReset();

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
  it('uses a single EXISTS subquery (posts only) for public filter', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // Tags are now exclusively linked to posts; one EXISTS subquery is sufficient.
    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('returns tags used by at least one published post', async () => {
    const mockTag = { id: 42, name: 'Bun', category: 'tool' };
    setupPublicQuery(1, [mockTag]);

    const result = await findManyTags({}, true);

    expect(result.data).toEqual([mockTag]);
    expect(result.meta.total).toBe(1);
    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('passes tag id to the EXISTS correlated subquery', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // eq() must be called with postTags.tagId and tags.id for the correlation
    const eqCalls = eqMock.mock.calls;
    const correlatedCalls = eqCalls.filter((args) => args[1] === tagsTable.id);
    expect(correlatedCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('applies isNull(deletedAt) filter inside the posts EXISTS subquery', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    expect(isNullMock).toHaveBeenCalledWith(postsTable.deletedAt);
  });

  it('returns empty list when no matching tags exist', async () => {
    setupPublicQuery(0, []);

    const result = await findManyTags({}, true);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(existsMock).toHaveBeenCalledTimes(1);
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
  it('uses a single postExists subquery when source is absent', async () => {
    setupPublicQuery(0, []);

    await findManyTags({}, true);

    // Tags are exclusively linked to posts — one EXISTS is always sufficient.
    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('uses a single postExists subquery when source=post is explicit', async () => {
    setupPublicQuery(0, []);

    await findManyTags({ source: 'post' }, true);

    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('combines category filter with the single postExists subquery', async () => {
    setupPublicQuery(1, [{ id: 1, name: 'TypeScript', category: 'language' }]);

    const result = await findManyTags({ source: 'post', category: 'language' }, true);

    expect(result.data).toHaveLength(1);
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

// ── findAllTagsForNormalization ───────────────────────────────────────────────

describe('findAllTagsForNormalization', () => {
  it('returns name/slug projections for all tags ordered by name', async () => {
    const rows = [
      { name: 'Redis', slug: 'redis' },
      { name: 'TypeScript', slug: 'typescript' },
    ];
    orderByMock.mockResolvedValueOnce(rows);
    fromMock.mockReturnValueOnce({ orderBy: orderByMock });

    const result = await findAllTagsForNormalization();

    expect(result).toEqual(rows);
    expect(ascMock).toHaveBeenCalledWith(tagsTable.name);
  });

  it('returns an empty array when no tags exist', async () => {
    orderByMock.mockResolvedValueOnce([]);
    fromMock.mockReturnValueOnce({ orderBy: orderByMock });

    const result = await findAllTagsForNormalization();

    expect(result).toEqual([]);
  });
});

// ── findTagsBySlugs ───────────────────────────────────────────────────────────

describe('findTagsBySlugs', () => {
  it('returns an empty array without querying the database when input is empty', async () => {
    const result = await findTagsBySlugs([]);

    expect(result).toEqual([]);
    // selectMock must NOT be called — short-circuit guards the DB
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('returns matching tags for the provided slugs', async () => {
    const rows = [
      {
        id: 5,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: 'si:SiRedis',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    orderByMock.mockResolvedValueOnce(rows);
    whereMock.mockReturnValueOnce({ orderBy: orderByMock });

    const result = await findTagsBySlugs(['redis']);

    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.slug, ['redis']);
    expect(result).toEqual(rows);
  });

  it('returns an empty array when none of the provided slugs exist', async () => {
    orderByMock.mockResolvedValueOnce([]);
    whereMock.mockReturnValueOnce({ orderBy: orderByMock });

    const result = await findTagsBySlugs(['nonexistent-slug']);

    expect(result).toEqual([]);
  });

  it('handles multiple slugs in a single batch query', async () => {
    const rows = [
      {
        id: 1,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        iconKey: 'si:SiTypescript',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    orderByMock.mockResolvedValueOnce(rows);
    whereMock.mockReturnValueOnce({ orderBy: orderByMock });

    const result = await findTagsBySlugs(['redis', 'typescript']);

    expect(inArrayMock).toHaveBeenCalledWith(tagsTable.slug, ['redis', 'typescript']);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ slug: 'redis' });
    expect(result[1]).toMatchObject({ slug: 'typescript' });
  });
});
