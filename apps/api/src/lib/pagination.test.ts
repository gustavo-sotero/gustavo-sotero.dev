import { describe, expect, it } from 'vitest';
import {
  buildPaginationMeta,
  buildWindowedPaginationMeta,
  buildWindowedResult,
  parsePagination,
} from './pagination';

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

describe('buildWindowedPaginationMeta', () => {
  it('builds next/previous navigation metadata without totals', () => {
    const result = buildWindowedPaginationMeta(3, 20, true);

    expect(result).toEqual({
      page: 3,
      perPage: 20,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});

describe('buildWindowedResult', () => {
  it('trims the probe row and reports hasNextPage when more results exist', () => {
    const result = buildWindowedResult([1, 2, 3], 1, 2);

    expect(result).toEqual({
      data: [1, 2],
      meta: {
        page: 1,
        perPage: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    });
  });

  it('keeps the current page rows when there is no next page', () => {
    const result = buildWindowedResult([1, 2], 2, 2);

    expect(result).toEqual({
      data: [1, 2],
      meta: {
        page: 2,
        perPage: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });
});
