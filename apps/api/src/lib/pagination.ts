import type { PaginationMeta } from '@portfolio/shared/types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

interface ParsedPagination {
  page: number;
  perPage: number;
  offset: number;
  limit: number;
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
