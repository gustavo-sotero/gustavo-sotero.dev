/**
 * Unit tests for admin experience and education routes.
 *
 * Covers: paginated list, create (success, validation error, conflict),
 * PATCH (valid update, invalid id, 404), DELETE (204, invalid id, 404).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const {
  listExperienceMock,
  getExperienceBySlugMock,
  createExperienceServiceMock,
  updateExperienceServiceMock,
  softDeleteExperienceServiceMock,
  listEducationMock,
  getEducationBySlugMock,
  createEducationServiceMock,
  updateEducationServiceMock,
  softDeleteEducationServiceMock,
} = vi.hoisted(() => ({
  listExperienceMock: vi.fn(),
  getExperienceBySlugMock: vi.fn(),
  createExperienceServiceMock: vi.fn(),
  updateExperienceServiceMock: vi.fn(),
  softDeleteExperienceServiceMock: vi.fn(),
  listEducationMock: vi.fn(),
  getEducationBySlugMock: vi.fn(),
  createEducationServiceMock: vi.fn(),
  updateEducationServiceMock: vi.fn(),
  softDeleteEducationServiceMock: vi.fn(),
}));

vi.mock('../../services/experience.service', () => ({
  listExperience: listExperienceMock,
  getExperienceBySlug: getExperienceBySlugMock,
  createExperienceService: createExperienceServiceMock,
  updateExperienceService: updateExperienceServiceMock,
  softDeleteExperienceService: softDeleteExperienceServiceMock,
}));

vi.mock('../../services/education.service', () => ({
  listEducation: listEducationMock,
  getEducationBySlug: getEducationBySlugMock,
  createEducationService: createEducationServiceMock,
  updateEducationService: updateEducationServiceMock,
  softDeleteEducationService: softDeleteEducationServiceMock,
}));

import { adminEducationRouter } from './education';
import { adminExperienceRouter } from './experience';

// ── helpers ───────────────────────────────────────────────────────────────────

const paginatedResult = (data: unknown[], total = data.length) => ({
  data,
  meta: { page: 1, perPage: 20, total, totalPages: Math.ceil(total / 20) },
});

const validExperienceBody = {
  role: 'Software Engineer',
  company: 'Acme Corp',
  description: 'Building things.',
  startDate: '2022-01-01',
  isCurrent: true,
  status: 'draft' as const,
  order: 0,
};

const validEducationBody = {
  title: 'Computer Science',
  institution: 'University',
  isCurrent: false,
  status: 'draft' as const,
  order: 0,
};

// ── Admin Experience routes ───────────────────────────────────────────────────

describe('admin experience routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // List ──────────────────────────────────────────────────────────────────────

  it('GET /admin/experience returns paginated data', async () => {
    listExperienceMock.mockResolvedValueOnce(paginatedResult([{ id: 1, slug: 'engineer-acme' }]));

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience');
    const body = (await res.json()) as { success: boolean; data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listExperienceMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, true);
  });

  it('GET /admin/experience filters by status', async () => {
    listExperienceMock.mockResolvedValueOnce(paginatedResult([]));

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    await app.request('/admin/experience?status=published');

    expect(listExperienceMock).toHaveBeenCalledWith(
      { page: 1, perPage: 20, status: 'published' },
      true
    );
  });

  it('GET /admin/experience returns 400 for invalid query params', async () => {
    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience?page=0');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // Create ─────────────────────────────────────────────────────────────────────

  it('POST /admin/experience returns 201 on success', async () => {
    createExperienceServiceMock.mockResolvedValueOnce({
      id: 1,
      slug: 'engineer-acme',
      ...validExperienceBody,
    });

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validExperienceBody),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('POST /admin/experience returns 400 with field-level details for missing required fields', async () => {
    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Only role' }), // missing company, description, startDate
    });

    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details: Array<{ field?: string; message: string }>;
      };
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    // Zod reports each missing required field separately
    expect(body.error.details.some((d) => d.field === 'company')).toBe(true);
    expect(body.error.details.some((d) => d.field === 'startDate')).toBe(true);
  });

  it('POST /admin/experience returns 400 when isCurrent=false and endDate is missing', async () => {
    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validExperienceBody, isCurrent: false, endDate: undefined }),
    });

    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /admin/experience returns 400 with field-level details when service throws invalid skillIds error', async () => {
    createExperienceServiceMock.mockRejectedValueOnce(
      Object.assign(new Error('VALIDATION_ERROR: One or more skillIds do not exist: 99'), {
        invalidSkillIds: [99],
      })
    );

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validExperienceBody, skillIds: [99] }),
    });

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((detail) => detail.field === 'skillIds')).toBe(true);
  });

  it('POST /admin/experience passes impactFacts to service', async () => {
    createExperienceServiceMock.mockResolvedValueOnce({
      id: 1,
      slug: 'engineer-acme',
      ...validExperienceBody,
      impactFacts: ['Reduziu tempo de deploy em 60%'],
    });

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validExperienceBody,
        impactFacts: ['Reduziu tempo de deploy em 60%'],
      }),
    });

    expect(res.status).toBe(201);
    expect(createExperienceServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ impactFacts: ['Reduziu tempo de deploy em 60%'] })
    );
  });

  it('POST /admin/experience returns 409 on slug conflict', async () => {
    createExperienceServiceMock.mockRejectedValueOnce(new Error('CONFLICT: Slug already taken'));

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validExperienceBody),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('CONFLICT');
  });

  it('POST /admin/experience returns 400 with exact message for service-thrown date validation', async () => {
    // Service-level validation (cross-field date ordering) is translated into a
    // scalar 400 VALIDATION_ERROR without a details array — the message itself
    // carries the diagnostic.
    createExperienceServiceMock.mockRejectedValueOnce(
      new Error('VALIDATION_ERROR: endDate must be on or after startDate')
    );

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    // Body passes Zod schema validation (endDate is after startDate) so the
    // schema refine doesn't fire — the service mock throws instead.
    const res = await app.request('/admin/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validExperienceBody, isCurrent: false, endDate: '2023-01-01' }),
    });

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    // Service-thrown errors carry the diagnostic message directly (no details array)
    expect(body.error.message).toBe('endDate must be on or after startDate');
    expect(body.error).not.toHaveProperty('details');
  });

  // PATCH ───────────────────────────────────────────────────────────────────────

  it('PATCH /admin/experience/:id returns 400 for non-integer id', async () => {
    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Updated' }),
    });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/experience/:id returns 404 when entry is missing', async () => {
    updateExperienceServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Updated' }),
    });

    expect(res.status).toBe(404);
  });

  it('PATCH /admin/experience/:id returns 400 with field-level details when service throws invalid skillIds error', async () => {
    updateExperienceServiceMock.mockRejectedValueOnce(
      Object.assign(new Error('VALIDATION_ERROR: One or more skillIds do not exist: 77'), {
        invalidSkillIds: [77],
      })
    );

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillIds: [77] }),
    });

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((detail) => detail.field === 'skillIds')).toBe(true);
  });

  it('PATCH /admin/experience/:id returns 200 on success', async () => {
    updateExperienceServiceMock.mockResolvedValueOnce({
      id: 1,
      role: 'Updated Engineer',
      slug: 'x',
    });

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Updated Engineer' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('PATCH /admin/experience/:id passes impactFacts to service', async () => {
    updateExperienceServiceMock.mockResolvedValueOnce({
      id: 1,
      slug: 'engineer-acme',
      impactFacts: ['Liderou squad de 4 devs'],
    });

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ impactFacts: ['Liderou squad de 4 devs'] }),
    });

    expect(res.status).toBe(200);
    expect(updateExperienceServiceMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ impactFacts: ['Liderou squad de 4 devs'] })
    );
  });

  // DELETE ──────────────────────────────────────────────────────────────────────

  it('DELETE /admin/experience/:id returns 400 for non-integer id', async () => {
    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/abc', { method: 'DELETE' });

    expect(res.status).toBe(400);
  });

  it('DELETE /admin/experience/:id returns 404 when entry is missing', async () => {
    softDeleteExperienceServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/999', { method: 'DELETE' });

    expect(res.status).toBe(404);
  });

  it('DELETE /admin/experience/:id returns 204 on success', async () => {
    softDeleteExperienceServiceMock.mockResolvedValueOnce({ id: 1 });

    const app = new Hono();
    app.route('/admin/experience', adminExperienceRouter);

    const res = await app.request('/admin/experience/1', { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(softDeleteExperienceServiceMock).toHaveBeenCalledWith(1);
  });
});

// ── Admin Education routes ────────────────────────────────────────────────────

describe('admin education routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // List ──────────────────────────────────────────────────────────────────────

  it('GET /admin/education returns paginated data', async () => {
    listEducationMock.mockResolvedValueOnce(paginatedResult([{ id: 2, slug: 'cs-university' }]));

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education');
    const body = (await res.json()) as { success: boolean; data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listEducationMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, true);
  });

  it('GET /admin/education filters by status', async () => {
    listEducationMock.mockResolvedValueOnce(paginatedResult([]));

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    await app.request('/admin/education?status=draft');

    expect(listEducationMock).toHaveBeenCalledWith({ page: 1, perPage: 20, status: 'draft' }, true);
  });

  // Create ─────────────────────────────────────────────────────────────────────

  it('POST /admin/education returns 201 on success', async () => {
    createEducationServiceMock.mockResolvedValueOnce({
      id: 2,
      slug: 'cs-university',
      ...validEducationBody,
    });

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validEducationBody),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('POST /admin/education returns 400 with field-level details for missing required fields', async () => {
    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Only title' }), // missing institution
    });

    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details: Array<{ field?: string; message: string }>;
      };
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.some((d) => d.field === 'institution')).toBe(true);
  });

  it('POST /admin/education returns 409 on slug conflict', async () => {
    createEducationServiceMock.mockRejectedValueOnce(new Error('CONFLICT: Slug already taken'));

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validEducationBody),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CONFLICT');
  });

  it('POST /admin/education returns 400 on date validation error from service', async () => {
    createEducationServiceMock.mockRejectedValueOnce(
      new Error('VALIDATION_ERROR: endDate must be on or after startDate')
    );

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validEducationBody,
        startDate: '2023-01-01',
        endDate: '2022-01-01',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // PATCH ───────────────────────────────────────────────────────────────────────

  it('PATCH /admin/education/:id returns 400 for non-integer id', async () => {
    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/NaN', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/education/:id returns 404 when entry is missing', async () => {
    updateEducationServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(404);
  });

  it('PATCH /admin/education/:id returns 200 on success', async () => {
    updateEducationServiceMock.mockResolvedValueOnce({ id: 2, title: 'Updated CS', slug: 'x' });

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated CS' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  // DELETE ──────────────────────────────────────────────────────────────────────

  it('DELETE /admin/education/:id returns 400 for non-integer id', async () => {
    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/abc', { method: 'DELETE' });

    expect(res.status).toBe(400);
  });

  it('DELETE /admin/education/:id returns 404 when entry is missing', async () => {
    softDeleteEducationServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/999', { method: 'DELETE' });

    expect(res.status).toBe(404);
  });

  it('DELETE /admin/education/:id returns 204 on success', async () => {
    softDeleteEducationServiceMock.mockResolvedValueOnce({ id: 2 });

    const app = new Hono();
    app.route('/admin/education', adminEducationRouter);

    const res = await app.request('/admin/education/2', { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(softDeleteEducationServiceMock).toHaveBeenCalledWith(2);
  });
});
