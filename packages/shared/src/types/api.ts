import type { ErrorCode } from '../constants/errorCodes';

// Pagination metadata
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
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

// Standard error detail (for validation errors)
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

// Standard error response body
export interface ApiErrorBody {
  code: ErrorCode;
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
