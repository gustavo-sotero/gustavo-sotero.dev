import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, HighlightLimitError } from '../../lib/errors';

const {
  listSkillsMock,
  getSkillByIdMock,
  createSkillServiceMock,
  updateSkillServiceMock,
  deleteSkillServiceMock,
} = vi.hoisted(() => ({
  listSkillsMock: vi.fn(),
  getSkillByIdMock: vi.fn(),
  createSkillServiceMock: vi.fn(),
  updateSkillServiceMock: vi.fn(),
  deleteSkillServiceMock: vi.fn(),
}));

vi.mock('../../services/skills.service', () => ({
  listSkills: listSkillsMock,
  getSkillById: getSkillByIdMock,
  createSkillService: createSkillServiceMock,
  updateSkillService: updateSkillServiceMock,
  deleteSkillService: deleteSkillServiceMock,
}));

import { adminSkillsRouter } from './skills';

const mockSkill = {
  id: 1,
  name: 'TypeScript',
  slug: 'typescript',
  category: 'language',
  iconKey: 'si:SiTypescript',
  expertiseLevel: 3,
  isHighlighted: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('admin skills routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/admin/skills', adminSkillsRouter);
  });

  // ── GET /admin/skills ──────────────────────────────────────────────────────
  describe('GET /admin/skills', () => {
    it('returns 200 with paginated data', async () => {
      listSkillsMock.mockResolvedValueOnce({
        data: [mockSkill],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const response = await app.request('/admin/skills');
      const body = (await response.json()) as {
        success: boolean;
        data: Array<{ id: number; name: string }>;
        meta: { total: number };
      };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.name).toBe('TypeScript');
    });

    it('does NOT use cache (passes false to listSkills)', async () => {
      listSkillsMock.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await app.request('/admin/skills');

      expect(listSkillsMock).toHaveBeenCalledWith(expect.anything(), false);
    });
  });

  // ── GET /admin/skills/:id ──────────────────────────────────────────────────
  describe('GET /admin/skills/:id', () => {
    it('returns 200 with skill data', async () => {
      getSkillByIdMock.mockResolvedValueOnce(mockSkill);

      const response = await app.request('/admin/skills/1');
      const body = (await response.json()) as { success: boolean; data: typeof mockSkill };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(1);
    });

    it('returns 404 when skill not found', async () => {
      getSkillByIdMock.mockResolvedValueOnce(null);

      const response = await app.request('/admin/skills/999');
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for non-integer id', async () => {
      const response = await app.request('/admin/skills/abc');
      expect(response.status).toBe(400);
    });
  });

  // ── POST /admin/skills ─────────────────────────────────────────────────────
  describe('POST /admin/skills', () => {
    it('returns 201 with created skill', async () => {
      createSkillServiceMock.mockResolvedValueOnce(mockSkill);

      const response = await app.request('/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TypeScript',
          category: 'language',
          expertiseLevel: 3,
          isHighlighted: true,
        }),
      });
      const body = (await response.json()) as { success: boolean; data: typeof mockSkill };

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('TypeScript');
    });

    it('returns 409 on CONFLICT error', async () => {
      createSkillServiceMock.mockRejectedValueOnce(
        new ConflictError('Skill name "TypeScript" is already taken')
      );

      const response = await app.request('/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'TypeScript', category: 'language' }),
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 409 on HIGHLIGHT_LIMIT error', async () => {
      createSkillServiceMock.mockRejectedValueOnce(
        new HighlightLimitError('Category "language" already has 2 highlighted skills.')
      );

      const response = await app.request('/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'NewLang', category: 'language', isHighlighted: true }),
      });
      const body = (await response.json()) as { success: boolean; error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 400 on invalid body', async () => {
      const response = await app.request('/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'TypeScript' }), // missing required category
      });

      expect(response.status).toBe(400);
    });
  });

  // ── PATCH /admin/skills/:id ────────────────────────────────────────────────
  describe('PATCH /admin/skills/:id', () => {
    it('returns 200 with updated skill', async () => {
      updateSkillServiceMock.mockResolvedValueOnce({ ...mockSkill, name: 'TypeScript v2' });

      const response = await app.request('/admin/skills/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'TypeScript v2' }),
      });
      const body = (await response.json()) as { success: boolean; data: { name: string } };

      expect(response.status).toBe(200);
      expect(body.data.name).toBe('TypeScript v2');
    });

    it('returns 404 when skill does not exist', async () => {
      updateSkillServiceMock.mockResolvedValueOnce(null);

      const response = await app.request('/admin/skills/999', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expertiseLevel: 2 }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 409 on CONFLICT error', async () => {
      updateSkillServiceMock.mockRejectedValueOnce(
        new ConflictError('Skill name "Hono" is already taken')
      );

      const response = await app.request('/admin/skills/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hono' }),
      });

      expect(response.status).toBe(409);
    });
  });

  // ── DELETE /admin/skills/:id ───────────────────────────────────────────────
  describe('DELETE /admin/skills/:id', () => {
    it('returns 204 on successful delete', async () => {
      deleteSkillServiceMock.mockResolvedValueOnce({ id: 1 });

      const response = await app.request('/admin/skills/1', { method: 'DELETE' });

      expect(response.status).toBe(204);
    });

    it('returns 404 when skill does not exist', async () => {
      deleteSkillServiceMock.mockResolvedValueOnce(null);

      const response = await app.request('/admin/skills/999', { method: 'DELETE' });
      const body = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
