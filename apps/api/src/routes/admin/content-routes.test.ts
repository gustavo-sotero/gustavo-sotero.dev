import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(listPostsMock).toHaveBeenCalledWith({ page: 1, perPage: 20, status: 'draft' }, true);
  });

  it('POST /admin/posts returns 409 on conflict', async () => {
    createPostServiceMock.mockRejectedValueOnce(new Error('CONFLICT: Slug already taken'));

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

    expect(response.status).toBe(409);
  });

  it('PATCH /admin/posts/:id returns 400 for invalid id', async () => {
    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Novo' }),
    });

    expect(response.status).toBe(400);
  });

  it('DELETE /admin/posts/:id returns 404 when post is missing', async () => {
    softDeletePostServiceMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/admin/posts', adminPostsRouter);

    const response = await app.request('/admin/posts/99', { method: 'DELETE' });
    expect(response.status).toBe(404);
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

  it('POST /admin/projects returns 409 on conflict', async () => {
    createProjectServiceMock.mockRejectedValueOnce(new Error('CONFLICT: Slug already taken'));

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

    expect(response.status).toBe(409);
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
      isHighlighted: false,
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
      category: 'language',
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
    // has no defaults so category and isHighlighted are absent when not sent.
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
});
