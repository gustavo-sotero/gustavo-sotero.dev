import type { ErrorCode, ErrorType } from '../constants/errorCodes';

// Pagination metadata
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// Offset pagination metadata without total counts.
export interface WindowedPaginationMeta {
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Standard successful API response
export interface ApiResponse<T> {
  success: true;
  data: T;
}

// Standard paginated API response
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

// Standard list response without total counts.
export interface WindowedResponse<T> {
  success: true;
  data: T[];
  meta: WindowedPaginationMeta;
}

// Standard error detail (for validation errors)
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

// Standard error response body
export interface ApiErrorBody {
  code: ErrorCode;
  type: ErrorType;
  message: string;
  details?: ApiErrorDetail[];
}

// Top-level error response
export interface ApiError {
  success: false;
  error: ApiErrorBody;
}

// Union type for any API response
export type ApiResult<T> = ApiResponse<T> | ApiError;
