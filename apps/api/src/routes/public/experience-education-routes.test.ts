/**
 * Unit tests for public experience and education routes.
 *
 * Covers: paginated list success, slug-based detail, 404 handling,
 * query validation, pagination meta shape.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const { listExperienceMock, getExperienceBySlugMock, listEducationMock, getEducationBySlugMock } =
  vi.hoisted(() => ({
    listExperienceMock: vi.fn(),
    getExperienceBySlugMock: vi.fn(),
    listEducationMock: vi.fn(),
    getEducationBySlugMock: vi.fn(),
  }));

vi.mock('../../services/experience.service', () => ({
  listExperience: listExperienceMock,
  getExperienceBySlug: getExperienceBySlugMock,
}));

vi.mock('../../services/education.service', () => ({
  listEducation: listEducationMock,
  getEducationBySlug: getEducationBySlugMock,
}));

import { publicEducationRouter } from './education';
import { publicExperienceRouter } from './experience';

// ── helpers ───────────────────────────────────────────────────────────────────

const paginatedResult = (data: unknown[], total = data.length) => ({
  data,
  meta: { page: 1, perPage: 20, total, totalPages: Math.ceil(total / 20) },
});

// ── Public Experience routes ──────────────────────────────────────────────────

describe('public experience routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /experience returns paginated data with default params', async () => {
    const entry = { id: 1, slug: 'engineer-acme', role: 'Engineer', company: 'Acme' };
    listExperienceMock.mockResolvedValueOnce(paginatedResult([entry]));

    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience');
    const body = (await res.json()) as {
      success: boolean;
      data: (typeof entry)[];
      meta: { total: number };
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(listExperienceMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, false);
  });

  it('GET /experience returns validation error for page=0', async () => {
    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience?page=0');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /experience returns empty list when no published entries', async () => {
    listExperienceMock.mockResolvedValueOnce(paginatedResult([]));

    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience');
    const body = (await res.json()) as { success: boolean; data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('GET /experience/:slug returns entry when found', async () => {
    const entry = { id: 1, slug: 'engineer-acme', role: 'Engineer', company: 'Acme' };
    getExperienceBySlugMock.mockResolvedValueOnce(entry);

    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience/engineer-acme');
    const body = (await res.json()) as { success: boolean; data: typeof entry };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('engineer-acme');
    expect(getExperienceBySlugMock).toHaveBeenCalledWith('engineer-acme', false);
  });

  it('GET /experience/:slug returns 404 when entry not found', async () => {
    getExperienceBySlugMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience/nao-existe');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /experience pagination meta reflects perPage param', async () => {
    listExperienceMock.mockResolvedValueOnce({
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, perPage: 2, total: 5, totalPages: 3 },
    });

    const app = new Hono();
    app.route('/experience', publicExperienceRouter);

    const res = await app.request('/experience?perPage=2');
    const body = (await res.json()) as { meta: { perPage: number; totalPages: number } };

    expect(res.status).toBe(200);
    expect(body.meta.perPage).toBe(2);
    expect(body.meta.totalPages).toBe(3);
  });
});

// ── Public Education routes ───────────────────────────────────────────────────

describe('public education routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /education returns paginated data with default params', async () => {
    const entry = { id: 2, slug: 'cs-university', title: 'Computer Science', institution: 'Uni' };
    listEducationMock.mockResolvedValueOnce(paginatedResult([entry]));

    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education');
    const body = (await res.json()) as {
      success: boolean;
      data: (typeof entry)[];
      meta: { total: number };
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(listEducationMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, false);
  });

  it('GET /education returns validation error for page=0', async () => {
    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education?page=0');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /education returns empty list when no published entries', async () => {
    listEducationMock.mockResolvedValueOnce(paginatedResult([]));

    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education');
    const body = (await res.json()) as { success: boolean; data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('GET /education/:slug returns entry when found', async () => {
    const entry = { id: 2, slug: 'cs-university', title: 'CS', institution: 'Uni' };
    getEducationBySlugMock.mockResolvedValueOnce(entry);

    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education/cs-university');
    const body = (await res.json()) as { success: boolean; data: typeof entry };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('cs-university');
    expect(getEducationBySlugMock).toHaveBeenCalledWith('cs-university', false);
  });

  it('GET /education/:slug returns 404 when entry not found', async () => {
    getEducationBySlugMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education/nao-existe');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /education pagination meta reflects perPage param', async () => {
    listEducationMock.mockResolvedValueOnce({
      data: [{ id: 1 }],
      meta: { page: 2, perPage: 5, total: 10, totalPages: 2 },
    });

    const app = new Hono();
    app.route('/education', publicEducationRouter);

    const res = await app.request('/education?page=2&perPage=5');
    const body = (await res.json()) as { meta: { page: number; perPage: number } };

    expect(res.status).toBe(200);
    expect(body.meta.page).toBe(2);
    expect(body.meta.perPage).toBe(5);
  });
});
