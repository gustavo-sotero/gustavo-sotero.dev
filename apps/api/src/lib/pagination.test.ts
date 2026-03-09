import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, parsePagination } from './pagination';

describe('parsePagination', () => {
  it('applies defaults when params are missing', () => {
    const result = parsePagination({});

    expect(result).toEqual({
      page: 1,
      perPage: 20,
      offset: 0,
      limit: 20,
    });
  });

  it('clamps invalid values and max perPage', () => {
    const result = parsePagination({ page: '-5', perPage: '999' });

    expect(result).toEqual({
      page: 1,
      perPage: 100,
      offset: 0,
      limit: 100,
    });
  });

  it('calculates offset for non-first pages', () => {
    const result = parsePagination({ page: '3', perPage: '10' });

    expect(result).toEqual({
      page: 3,
      perPage: 10,
      offset: 20,
      limit: 10,
    });
  });
});

describe('buildPaginationMeta', () => {
  it('builds correct pagination metadata', () => {
    const result = buildPaginationMeta(42, 2, 20);

    expect(result).toEqual({
      page: 2,
      perPage: 20,
      total: 42,
      totalPages: 3,
    });
  });
});
