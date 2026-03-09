import type { ErrorCode } from '@shared/constants/errorCodes';
import type { PaginationMeta } from '@shared/types/api';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Standard successful response.
 */
export function successResponse<T>(c: Context, data: T, status = 200): Response {
  return c.json({ success: true, data }, status as ContentfulStatusCode);
}

/**
 * Standard paginated response.
 */
export function paginatedResponse<T>(c: Context, data: T[], meta: PaginationMeta): Response {
  return c.json({ success: true, data, meta });
}

/**
 * Standard error response.
 */
export function errorResponse(
  c: Context,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: Array<{ field?: string; message: string }>
): Response {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    statusCode as ContentfulStatusCode
  );
}
