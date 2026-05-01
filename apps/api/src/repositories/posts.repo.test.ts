import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  andMock,
  eqMock,
  isNullMock,
  lteMock,
  inArrayMock,
  countMock,
  sqlMock,
  postsTable,
  postTagsTable,
  tagsTable,
} = vi.hoisted(() => ({
  andMock: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  eqMock: vi.fn(() => ({ _op: 'eq' })),
  isNullMock: vi.fn(() => ({ _op: 'isNull' })),
  lteMock: vi.fn(() => ({ _op: 'lte' })),
  inArrayMock: vi.fn(() => ({ _op: 'inArray' })),
  countMock: vi.fn(() => ({ _op: 'count' })),
  sqlMock: vi.fn(() => ({ _op: 'sql' })),
  postsTable: {
    id: 'posts.id',
    slug: 'posts.slug',
    status: 'posts.status',
    deletedAt: 'posts.deletedAt',
    publishedAt: 'posts.publishedAt',
    createdAt: 'posts.createdAt',
    order: 'posts.order',
  },
  postTagsTable: {
    postId: 'postTags.postId',
    tagId: 'postTags.tagId',
  },
  tagsTable: {
    id: 'tags.id',
    slug: 'tags.slug',
  },
}));

const {
  selectWhereMock,
  selectFromMock,
  dbSelectMock,
  findManyMock,
  findFirstMock,
  parsePaginationMock,
  buildPaginationMetaMock,
} = vi.hoisted(() => ({
  selectWhereMock: vi.fn(),
  selectFromMock: vi.fn(),
  dbSelectMock: vi.fn(),
  findManyMock: vi.fn(),
  findFirstMock: vi.fn(),
  parsePaginationMock: vi.fn(),
  buildPaginationMetaMock: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: andMock,
  eq: eqMock,
  isNull: isNullMock,
  lte: lteMock,
  inArray: inArrayMock,
  count: countMock,
  sql: sqlMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  posts: postsTable,
  postTags: postTagsTable,
  tags: tagsTable,
}));

vi.mock('../lib/pagination', () => ({
  parsePagination: parsePaginationMock,
  buildPaginationMeta: buildPaginationMetaMock,
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    query: {
      posts: {
        findMany: findManyMock,
        findFirst: findFirstMock,
      },
    },
  },
}));

import { findManyPosts, findPostBySlug } from './posts.repo';

beforeEach(() => {
  vi.clearAllMocks();

  parsePaginationMock.mockReturnValue({ page: 1, perPage: 20, offset: 0, limit: 20 });
  buildPaginationMetaMock.mockReturnValue({ page: 1, perPage: 20, total: 1, totalPages: 1 });

  selectWhereMock.mockResolvedValue([{ total: 1 }]);
  selectFromMock.mockReturnValue({ where: selectWhereMock });
  dbSelectMock.mockReturnValue({ from: selectFromMock });

  findManyMock.mockResolvedValue([]);
  findFirstMock.mockResolvedValue(null);
});

describe('posts repository temporal guard', () => {
  it('aplica guarda temporal em listagem pública (publishedAt <= now)', async () => {
    await findManyPosts({}, false);

    expect(lteMock).toHaveBeenCalledWith(postsTable.publishedAt, expect.anything());
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('não aplica guarda temporal em listagem admin', async () => {
    await findManyPosts({}, true);

    expect(lteMock).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('aplica guarda temporal no detalhe público por slug', async () => {
    await findPostBySlug('post-publico', false);

    expect(lteMock).toHaveBeenCalledWith(postsTable.publishedAt, expect.anything());
    expect(findFirstMock).toHaveBeenCalledTimes(1);
  });
});

describe('posts repository sort ordering', () => {
  it('usa ordenação manual quando sort=manual', async () => {
    await findManyPosts({ sort: 'manual' }, false);

    const allInterpolatedValues = sqlMock.mock.calls.flatMap((call) => call.slice(1));
    expect(allInterpolatedValues).toContain(postsTable.order);
  });

  it('não usa ordem manual quando sort=recent', async () => {
    await findManyPosts({ sort: 'recent' }, false);

    const allInterpolatedValues = sqlMock.mock.calls.flatMap((call) => call.slice(1));
    expect(allInterpolatedValues).not.toContain(postsTable.order);
  });

  it('não usa ordem manual por padrão (sort omitido)', async () => {
    await findManyPosts({}, false);

    const allInterpolatedValues = sqlMock.mock.calls.flatMap((call) => call.slice(1));
    expect(allInterpolatedValues).not.toContain(postsTable.order);
  });

  it('pula a query de total quando includeTotal=false', async () => {
    findManyMock.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    await findManyPosts({ page: 1, perPage: 20 }, false, { includeTotal: false });

    expect(countMock).not.toHaveBeenCalled();
    expect(buildPaginationMetaMock).toHaveBeenCalledWith(2, 1, 20);
  });
});
