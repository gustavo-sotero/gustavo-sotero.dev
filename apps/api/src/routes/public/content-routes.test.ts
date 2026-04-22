import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPostsMock, getPostBySlugMock, listProjectsMock, getProjectBySlugMock, listTagsMock } =
  vi.hoisted(() => ({
    listPostsMock: vi.fn(),
    getPostBySlugMock: vi.fn(),
    listProjectsMock: vi.fn(),
    getProjectBySlugMock: vi.fn(),
    listTagsMock: vi.fn(),
  }));

vi.mock('../../services/posts.service', () => ({
  listPosts: listPostsMock,
  getPostBySlug: getPostBySlugMock,
}));

vi.mock('../../services/projects.service', () => ({
  listProjects: listProjectsMock,
  getProjectBySlug: getProjectBySlugMock,
}));

vi.mock('../../services/tags.service', () => ({
  listTags: listTagsMock,
}));

import { publicPostsRouter } from './posts';
import { publicProjectsRouter } from './projects';
import { publicTagsRouter } from './tags';

describe('public content routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /posts returns validation error for invalid query', async () => {
    const app = new Hono();
    app.route('/posts', publicPostsRouter);

    const response = await app.request('/posts?page=0');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /posts returns paginated data', async () => {
    listPostsMock.mockResolvedValueOnce({
      data: [{ id: 1, slug: 'post-1' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/posts', publicPostsRouter);

    const response = await app.request('/posts?page=1&perPage=20');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; slug: string }>;
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(listPostsMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, false);
  });

  it('GET /posts/:slug returns 404 when post is missing', async () => {
    getPostBySlugMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/posts', publicPostsRouter);

    const response = await app.request('/posts/inexistente');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /projects returns paginated data', async () => {
    listProjectsMock.mockResolvedValueOnce({
      data: [{ id: 10, slug: 'project-1' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects?featured=true');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; slug: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listProjectsMock).toHaveBeenCalledWith({ featured: true, page: 1, perPage: 20 }, false);
  });

  it('GET /projects?featuredFirst=true passes flag to service', async () => {
    listProjectsMock.mockResolvedValueOnce({
      data: [
        { id: 1, slug: 'featured-project', featured: true },
        { id: 2, slug: 'normal-project', featured: false },
      ],
      meta: { page: 1, perPage: 3, total: 2, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects?featuredFirst=true&perPage=3');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; slug: string; featured: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(listProjectsMock).toHaveBeenCalledWith(
      { featuredFirst: true, page: 1, perPage: 3 },
      false
    );
  });

  it('GET /projects?featuredFirst=true can coexist with featured=true', async () => {
    listProjectsMock.mockResolvedValueOnce({
      data: [{ id: 1, slug: 'featured-project', featured: true }],
      meta: { page: 1, perPage: 3, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects?featured=true&featuredFirst=true&perPage=3');
    const body = (await response.json()) as { success: boolean; data: unknown[] };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(listProjectsMock).toHaveBeenCalledWith(
      { featured: true, featuredFirst: true, page: 1, perPage: 3 },
      false
    );
  });

  it('GET /projects/:slug returns 404 when project is missing', async () => {
    getProjectBySlugMock.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects/projeto-inexistente');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /tags returns validation error for invalid category', async () => {
    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?category=invalid');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /tags returns tags in use', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 1, name: 'TypeScript', slug: 'typescript' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?category=language,framework');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listTagsMock).toHaveBeenCalledWith({ category: 'language,framework' }, true);
  });

  it('GET /tags accepts cloud category filter', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 2, name: 'GCP', slug: 'gcp' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?category=cloud');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(listTagsMock).toHaveBeenCalledWith({ category: 'cloud' }, true);
  });

  it('GET /tags accepts infra category filter', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 3, name: 'Docker', slug: 'docker' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?category=infra');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(listTagsMock).toHaveBeenCalledWith({ category: 'infra' }, true);
  });

  it('GET /tags accepts combined cloud,infra category filter', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?category=cloud,infra');
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(listTagsMock).toHaveBeenCalledWith({ category: 'cloud,infra' }, true);
  });

  it('GET /tags?source=project passes source to service', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 1, name: 'TypeScript', slug: 'typescript' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?source=project');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ id: number; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listTagsMock).toHaveBeenCalledWith({ source: 'project' }, true);
  });

  it('GET /tags?source=post passes source to service', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?source=post');
    expect(response.status).toBe(200);
    expect(listTagsMock).toHaveBeenCalledWith({ source: 'post' }, true);
  });

  it('GET /tags?source=experience passes source to service', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?source=experience');
    expect(response.status).toBe(200);
    expect(listTagsMock).toHaveBeenCalledWith({ source: 'experience' }, true);
  });

  it('GET /tags?source=invalid returns validation error', async () => {
    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?source=admin');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /tags?source=project&category=language passes both filters to service', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 1, name: 'TypeScript', slug: 'typescript' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags?source=project&category=language');
    expect(response.status).toBe(200);
    expect(listTagsMock).toHaveBeenCalledWith({ source: 'project', category: 'language' }, true);
  });

  it('GET /tags without source preserves legacy union behaviour', async () => {
    listTagsMock.mockResolvedValueOnce({
      data: [{ id: 1, name: 'TypeScript', slug: 'typescript' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/tags', publicTagsRouter);

    const response = await app.request('/tags');
    expect(response.status).toBe(200);
    expect(listTagsMock).toHaveBeenCalledWith({}, true);
  });

  it('GET /projects/:slug includes impactFacts in the response body', async () => {
    const project = {
      id: 5,
      slug: 'projeto-impacto',
      title: 'Projeto com impacto',
      impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'],
    };
    getProjectBySlugMock.mockResolvedValueOnce(project);

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects/projeto-impacto');
    const body = (await response.json()) as {
      success: boolean;
      data: { slug: string; impactFacts: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.impactFacts).toEqual(['Reduziu latência em 40%', 'Adotado por +200 devs']);
  });

  it('GET /projects includes impactFacts in paginated list items', async () => {
    listProjectsMock.mockResolvedValueOnce({
      data: [{ id: 1, slug: 'projeto-1', impactFacts: ['Fato quantificado: +30% uptime'] }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });

    const app = new Hono();
    app.route('/projects', publicProjectsRouter);

    const response = await app.request('/projects');
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{ slug: string; impactFacts: string[] }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]?.impactFacts).toEqual(['Fato quantificado: +30% uptime']);
  });
});
