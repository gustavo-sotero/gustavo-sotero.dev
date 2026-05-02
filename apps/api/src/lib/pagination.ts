import type { PaginationMeta, WindowedPaginationMeta } from '@portfolio/shared/types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

interface ParsedPagination {
  page: number;
  perPage: number;
  offset: number;
  limit: number;
}

export interface TotalCountQueryOptions {
  includeTotal?: boolean;
}

export interface PaginatedListResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface WindowedListResult<T> {
  data: T[];
  meta: WindowedPaginationMeta;
}

/**
 * Parse pagination query params from raw query object.
 * Applies defaults and enforces max perPage.
 */
export function parsePagination(query: {
  page?: string | number;
  perPage?: string | number;
}): ParsedPagination {
  const page = Math.max(1, Number(query.page ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(query.perPage ?? DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE)
  );

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    limit: perPage,
  };
}

/**
 * Build paginations meta from total count + page params.
 */
export function buildPaginationMeta(total: number, page: number, perPage: number): PaginationMeta {
  return {
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Build pagination metadata for no-count list endpoints.
 */
export function buildWindowedPaginationMeta(
  page: number,
  perPage: number,
  hasNextPage: boolean
): WindowedPaginationMeta {
  return {
    page,
    perPage,
    hasNextPage,
    hasPreviousPage: page > 1,
  };
}

/**
 * Trim a `perPage + 1` probe row and expose truthful next/previous navigation.
 */
export function buildWindowedResult<T>(
  rows: T[],
  page: number,
  perPage: number
): WindowedListResult<T> {
  const hasNextPage = rows.length > perPage;

  return {
    data: hasNextPage ? rows.slice(0, perPage) : rows,
    meta: buildWindowedPaginationMeta(page, perPage, hasNextPage),
  };
}
