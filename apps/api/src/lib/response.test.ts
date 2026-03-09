import type { PaginationMeta } from '@shared/types/api';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { errorResponse, paginatedResponse, successResponse } from './response';

describe('response helpers', () => {
  it('returns standardized success payload', async () => {
    const app = new Hono();
    app.get('/ok', (c) => successResponse(c, { value: 1 }, 201));

    const response = await app.request('/ok');
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: { value: 1 },
    });
  });

  it('returns standardized paginated payload', async () => {
    const app = new Hono();
    const meta: PaginationMeta = {
      page: 1,
      perPage: 10,
      total: 25,
      totalPages: 3,
    };

    app.get('/list', (c) => paginatedResponse(c, [{ id: 1 }], meta));

    const response = await app.request('/list');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: [{ id: 1 }],
      meta,
    });
  });

  it('returns standardized error payload', async () => {
    const app = new Hono();
    app.get('/error', (c) =>
      errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'name', message: 'Required field' },
      ])
    );

    const response = await app.request('/error');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'name', message: 'Required field' }],
      },
    });
  });
});
