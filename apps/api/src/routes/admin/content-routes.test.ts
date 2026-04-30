import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, DomainValidationError } from '../../lib/errors';

const {
  listPostsMock,
  createPostServiceMock,
  updatePostServiceMock,
  softDeletePostServiceMock,
  listProjectsMock,
  createProjectServiceMock,
  updateProjectServiceMock,
  softDeleteProjectServiceMock,
  listTagsMock,
  createTagServiceMock,
  updateTagServiceMock,
  deleteTagServiceMock,
  resolveAiSuggestedTagsMock,
} = vi.hoisted(() => ({
  listPostsMock: vi.fn(),
  createPostServiceMock: vi.fn(),
  updatePostServiceMock: vi.fn(),
  softDeletePostServiceMock: vi.fn(),
  listProjectsMock: vi.fn(),
  createProjectServiceMock: vi.fn(),
  updateProjectServiceMock: vi.fn(),
  softDeleteProjectServiceMock: vi.fn(),
  listTagsMock: vi.fn(),
  createTagServiceMock: vi.fn(),
  updateTagServiceMock: vi.fn(),
  deleteTagServiceMock: vi.fn(),
  resolveAiSuggestedTagsMock: vi.fn(),
}));

vi.mock('../../services/posts.service', () => ({
  listPosts: listPostsMock,
  createPostService: createPostServiceMock,
  updatePostService: updatePostServiceMock,
  softDeletePostService: softDeletePostServiceMock,
  getPostBySlug: vi.fn(),
}));

vi.mock('../../services/projects.service', () => ({
  listProjects: listProjectsMock,
  createProjectService: createProjectServiceMock,
  updateProjectService: updateProjectServiceMock,
  softDeleteProjectService: softDeleteProjectServiceMock,
  getProjectBySlug: vi.fn(),
}));

vi.mock('../../services/tags.service', () => ({
  listTags: listTagsMock,
  createTagService: createTagServiceMock,
  updateTagService: updateTagServiceMock,
  deleteTagService: deleteTagServiceMock,
  resolveAiSuggestedTags: resolveAiSuggestedTagsMock,
}));

import { adminPostsRouter } from './posts';
import { adminProjectsRouter } from './projects';
import { adminTagsRouter } from './tags';

describe('admin content routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/posts returns paginated data', async () => {
    listPostsMock.mockResolvedValueOnce({
      data: [{ id: 1, slug: 'post-admin' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts?status=draft');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listPostsMock).toHaveBeenCalledWith(
      { page: 1, perPage: 20, status: 'draft', sort: 'recent', tag: undefined },
      true
    );
  });

  it('POST /admin/posts returns 409 on conflict with error envelope', async () => {
    createPostServiceMock.mockRejectedValueOnce(new ConflictError('Slug already taken'));

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Post',
        content: 'Conteúdo',
        status: 'draft',
      }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('POST /admin/posts returns 400 with field-level details when service throws invalid tagIds error', async () => {
    createPostServiceMock.mockRejectedValueOnce(
      new DomainValidationError('One or more tagIds do not exist: 99', [
        { field: 'tagIds', message: 'Tag ID 99 not found' },
      ])
    );

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Post', content: 'C', status: 'draft', tagIds: [99] }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((d) => d.field === 'tagIds')).toBe(true);
  });

  it('PATCH /admin/posts/:id returns 400 with field-level details when service throws invalid tagIds error', async () => {
    updatePostServiceMock.mockRejectedValueOnce(
      new DomainValidationError('One or more tagIds do not exist: 88', [
        { field: 'tagIds', message: 'Tag ID 88 not found' },
      ])
    );

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: [88] }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((d) => d.field === 'tagIds')).toBe(true);
  });

  it('POST /admin/posts returns 400 with field-level validation details for missing required fields', async () => {
    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    // Sending an empty body — validateBody should produce a VALIDATION_ERROR
    // with field-level details for each missing required field.
    const response = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details: Array<{ field?: string; message: string }>;
      };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    // At least one detail entry must have a `field` key for a missing required field
    expect(body.error.details.some((d) => typeof d.field === 'string')).toBe(true);
    expect(body.error.details.some((d) => d.field === 'title')).toBe(true);
  });

  it('PATCH /admin/posts/:id returns 400 for invalid id with error envelope', async () => {
    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Novo' }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid post ID');
  });

  it('DELETE /admin/posts/:id returns 404 when post is missing', async () => {
    softDeletePostServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/99', { method: 'DELETE' });
    expect(response.status).toBe(404);
  });

  it('POST /admin/posts accepts order field and passes it to service', async () => {
    createPostServiceMock.mockResolvedValueOnce({ id: 1, slug: 'novo-post', order: 5 });

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Novo Post', content: 'Conteúdo', status: 'draft', order: 5 }),
    });

    expect(response.status).toBe(201);
    expect(createPostServiceMock).toHaveBeenCalledWith(expect.objectContaining({ order: 5 }));
  });

  it('PATCH /admin/posts/:id accepts order field and passes it to service', async () => {
    updatePostServiceMock.mockResolvedValueOnce({ id: 1, slug: 'post-1', order: 3 });

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: 3 }),
    });

    expect(response.status).toBe(200);
    expect(updatePostServiceMock).toHaveBeenCalledWith(1, expect.objectContaining({ order: 3 }));
  });

  it('GET /admin/projects returns paginated data', async () => {
    listProjectsMock.mockResolvedValueOnce({
      data: [{ id: 1, slug: 'project-admin' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects?featured=true');
    expect(response.status).toBe(200);
    expect(listProjectsMock).toHaveBeenCalledWith({ featured: true, page: 1, perPage: 20 }, true);
  });

  it('POST /admin/projects returns 409 on conflict with error envelope', async () => {
    createProjectServiceMock.mockRejectedValueOnce(new ConflictError('Slug already taken'));

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Projeto',
        content: 'Conteúdo',
        status: 'draft',
      }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('POST /admin/projects returns 400 with field-level details when service throws invalid skillIds error', async () => {
    createProjectServiceMock.mockRejectedValueOnce(
      new DomainValidationError('One or more skillIds do not exist: 55', [
        { field: 'skillIds', message: 'Skill ID 55 not found' },
      ])
    );

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Projeto', content: 'C', status: 'draft', skillIds: [55] }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((d) => d.field === 'skillIds')).toBe(true);
  });

  it('PATCH /admin/projects/:id returns 400 with field-level details when service throws invalid skillIds error', async () => {
    updateProjectServiceMock.mockRejectedValueOnce(
      new DomainValidationError('One or more skillIds do not exist: 44', [
        { field: 'skillIds', message: 'Skill ID 44 not found' },
      ])
    );

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillIds: [44] }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field?: string }> };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.some((d) => d.field === 'skillIds')).toBe(true);
  });

  it('POST /admin/projects returns 400 with field-level validation details for missing required fields', async () => {
    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const body = (await response.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details: Array<{ field?: string; message: string }>;
      };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.some((d) => typeof d.field === 'string')).toBe(true);
    expect(body.error.details.some((d) => d.field === 'title')).toBe(true);
  });

  it('POST /admin/projects passes impactFacts to service', async () => {
    createProjectServiceMock.mockResolvedValueOnce({
      id: 1,
      slug: 'project-admin',
      title: 'Projeto com impacto',
      impactFacts: ['Reduziu latência em 40%'],
    });

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Projeto com impacto',
        content: 'Conteúdo',
        status: 'draft',
        impactFacts: ['Reduziu latência em 40%'],
      }),
    });

    expect(response.status).toBe(201);
    expect(createProjectServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ impactFacts: ['Reduziu latência em 40%'] })
    );
  });

  it('PATCH /admin/projects/:id passes impactFacts to service', async () => {
    updateProjectServiceMock.mockResolvedValueOnce({
      id: 1,
      slug: 'project-admin',
      impactFacts: ['Adotado por +200 devs'],
    });

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ impactFacts: ['Adotado por +200 devs'] }),
    });

    expect(response.status).toBe(200);
    expect(updateProjectServiceMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ impactFacts: ['Adotado por +200 devs'] })
    );
  });

  it('DELETE /admin/projects/:id returns 404 when project is missing', async () => {
    softDeleteProjectServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/projects', adminProjectsRouter);

    const response = await app.request('/admin/projects/99', { method: 'DELETE' });
    expect(response.status).toBe(404);
  });

  it('GET /admin/tags returns data', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 1, name: 'TypeScript', slug: 'typescript' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listTagsMock).toHaveBeenCalledWith({}, false);
  });

  it('POST /admin/tags ignores manual iconKey in request payload', async () => {
    createTagServiceMock.mockResolvedValueOnce({
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      iconKey: 'si:SiTypescript',
    });

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TypeScript',
        category: 'language',
        iconKey: 'si:SiDocker',
      }),
    });

    expect(response.status).toBe(201);
    expect(createTagServiceMock).toHaveBeenCalledWith({
      name: 'TypeScript',
      category: 'language',
    });
  });

  it('PATCH /admin/tags/:id returns 404 when tag is missing', async () => {
    updateTagServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/88', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Novo nome' }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /admin/tags/:id ignores manual iconKey in request payload', async () => {
    updateTagServiceMock.mockResolvedValueOnce({
      id: 88,
      name: 'Node.js',
      slug: 'nodejs',
      category: 'tool',
      iconKey: 'si:SiNodedotjs',
    });

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/88', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Node.js',
        iconKey: 'si:SiDocker',
      }),
    });

    expect(response.status).toBe(200);
    // Only the explicitly provided fields should be forwarded — the update schema
    // has no defaults so category is absent when not sent.
    expect(updateTagServiceMock).toHaveBeenCalledWith(88, {
      name: 'Node.js',
    });
  });

  it('DELETE /admin/tags/:id returns 404 when tag is missing', async () => {
    deleteTagServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/88', {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });

  it('POST /admin/tags returns 400 with field-level validation details for missing name', async () => {
    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'language' }), // missing required `name`
    });

    const body = (await response.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details: Array<{ field?: string; message: string }>;
      };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.some((d) => d.field === 'name')).toBe(true);
  });

  it('POST /admin/tags/resolve-ai-suggested returns resolved tags with status 200', async () => {
    resolveAiSuggestedTagsMock.mockResolvedValueOnce([
      {
        id: 5,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: 'si:SiRedis',
        createdAt: '2026-04-24T00:00:00.000Z',
      },
    ]);

    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/resolve-ai-suggested', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: ['Redis', 'redis'] }),
    });

    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: 5, name: 'Redis' });
    expect(resolveAiSuggestedTagsMock).toHaveBeenCalledWith(['Redis', 'redis']);
  });

  it('POST /admin/tags/resolve-ai-suggested returns 400 for empty names array', async () => {
    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/resolve-ai-suggested', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: [] }),
    });

    expect(response.status).toBe(400);
    expect(resolveAiSuggestedTagsMock).not.toHaveBeenCalled();
  });

  it('POST /admin/tags/resolve-ai-suggested returns 400 when names field is absent', async () => {
    const app = new Hono();
    app.route('/admin/tags', adminTagsRouter);

    const response = await app.request('/admin/tags/resolve-ai-suggested', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(resolveAiSuggestedTagsMock).not.toHaveBeenCalled();
  });
});
