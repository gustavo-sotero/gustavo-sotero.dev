import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDeveloperProfileMock } = vi.hoisted(() => ({
  getDeveloperProfileMock: vi.fn(),
}));

vi.mock('../../services/developer-profile.service', () => ({
  getDeveloperProfile: getDeveloperProfileMock,
}));

import { publicDeveloperRouter } from './developer';

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  profile: {
    name: 'Gustavo Sotero',
    role: 'Desenvolvedor Fullstack',
    bio: 'Desenvolvedor Fullstack com 3+ anos...',
    location: 'Brasil',
    availability: 'Disponível para novos projetos',
    links: {
      github: 'https://github.com/gustavosotero',
      linkedin: 'https://linkedin.com/in/gustavosotero',
      website: 'https://gustavo-sotero.dev',
    },
  },
  stack: {
    groups: {
      language: [
        {
          id: 1,
          name: 'TypeScript',
          slug: 'typescript',
          category: 'language',
          iconKey: 'si:SiTypescript',
        },
      ],
      framework: [],
      tool: [],
      db: [],
      cloud: [],
      infra: [],
      other: [],
    },
  },
  experience: [
    {
      id: 1,
      slug: 'senior-dev',
      company: 'Acme Corp',
      role: 'Senior Developer',
      description: 'Backend development.',
      location: 'Remote',
      employmentType: 'full-time',
      startDate: '2022-01-01T00:00:00.000Z',
      endDate: null,
      isCurrent: true,
      order: 0,
      logoUrl: null,
    },
  ],
  education: [
    {
      id: 1,
      slug: 'bsc-cs',
      title: 'Bacharelado em Ciência da Computação',
      institution: 'Universidade Federal',
      description: null,
      location: 'São Paulo, Brasil',
      educationType: 'graduation',
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2022-12-01T00:00:00.000Z',
      isCurrent: false,
      workloadHours: null,
      order: 0,
      logoUrl: null,
    },
  ],
  projects: [
    {
      id: 1,
      slug: 'portfolio-api',
      title: 'Portfolio API',
      description: 'REST API with Bun + Hono.',
      coverUrl: null,
      featured: true,
      repositoryUrl: 'https://github.com/example/portfolio',
      liveUrl: 'https://gustavo-sotero.dev/api',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
      tags: [
        {
          id: 1,
          name: 'TypeScript',
          slug: 'typescript',
          category: 'language',
          iconKey: 'si:SiTypescript',
        },
      ],
    },
  ],
  posts: [
    {
      id: 1,
      slug: 'building-apis-with-hono',
      title: 'Building APIs with Hono and Bun',
      excerpt: 'How I built a production-grade API.',
      coverUrl: null,
      publishedAt: '2025-03-15T12:00:00.000Z',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-15T12:00:00.000Z',
      tags: [],
    },
  ],
  metrics: {
    totalPostsPublished: 12,
    totalProjectsPublished: 5,
    totalTagsInUse: 18,
    pageviews30d: 3240,
    lastCalculatedAt: '2026-02-27T10:00:00.000Z',
  },
  updatedAt: '2026-02-27T10:00:00.000Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /developer/profile', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    getDeveloperProfileMock.mockResolvedValue(MOCK_PROFILE);
    app = new Hono();
    app.route('/developer', publicDeveloperRouter);
  });

  it('returns 200 with success envelope', async () => {
    const response = await app.request('/developer/profile');

    expect(response.status).toBe(200);

    const body = (await response.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('response Content-Type is application/json', async () => {
    const response = await app.request('/developer/profile');

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('response body is pretty-printed (contains newlines and indentation)', async () => {
    const response = await app.request('/developer/profile');
    const text = await response.text();

    // Pretty JSON always has newlines and at least 2-space indentation
    expect(text).toContain('\n');
    expect(text).toContain('  ');
  });

  it('payload contains all required top-level blocks', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(body.data).toHaveProperty('profile');
    expect(body.data).toHaveProperty('stack');
    expect(body.data).toHaveProperty('experience');
    expect(body.data).toHaveProperty('education');
    expect(body.data).toHaveProperty('projects');
    expect(body.data).toHaveProperty('posts');
    expect(body.data).toHaveProperty('metrics');
    expect(body.data).toHaveProperty('updatedAt');
  });

  it('profile block contains required identity fields', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    expect(body.data.profile.name).toBe('Gustavo Sotero');
    expect(body.data.profile.role).toBe('Desenvolvedor Fullstack');
    expect(typeof body.data.profile.bio).toBe('string');
    expect(body.data.profile.availability).toBeTruthy();
    expect(body.data.profile.links).toHaveProperty('github');
    expect(body.data.profile.links).toHaveProperty('linkedin');
  });

  it('stack block contains all category groups', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    const groups = body.data.stack.groups;
    expect(groups).toHaveProperty('language');
    expect(groups).toHaveProperty('framework');
    expect(groups).toHaveProperty('tool');
    expect(groups).toHaveProperty('db');
    expect(groups).toHaveProperty('cloud');
    expect(groups).toHaveProperty('infra');
    expect(groups).toHaveProperty('other');
    expect(Array.isArray(groups.language)).toBe(true);
  });

  it('experience items contain required fields', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    expect(Array.isArray(body.data.experience)).toBe(true);
    if (body.data.experience.length > 0) {
      const item = body.data.experience[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('slug');
      expect(item).toHaveProperty('company');
      expect(item).toHaveProperty('role');
      expect(item).toHaveProperty('startDate');
      expect(item).toHaveProperty('isCurrent');
    }
  });

  it('education items contain required fields', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    expect(Array.isArray(body.data.education)).toBe(true);
    if (body.data.education.length > 0) {
      const item = body.data.education[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('slug');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('institution');
      expect(item).toHaveProperty('isCurrent');
    }
  });

  it('project summary items contain required fields', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    expect(Array.isArray(body.data.projects)).toBe(true);
    if (body.data.projects.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length checked above
      const project = body.data.projects[0]!;
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('slug');
      expect(project).toHaveProperty('title');
      expect(project).toHaveProperty('featured');
      expect(project).toHaveProperty('tags');
      expect(Array.isArray(project.tags)).toBe(true);
    }
  });

  it('post summary items contain required fields', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    expect(Array.isArray(body.data.posts)).toBe(true);
    if (body.data.posts.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length checked above
      const post = body.data.posts[0]!;
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('tags');
      expect(Array.isArray(post.tags)).toBe(true);
    }
  });

  it('metrics block contains all required counters', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: typeof MOCK_PROFILE };

    const { metrics } = body.data;
    expect(typeof metrics.totalPostsPublished).toBe('number');
    expect(typeof metrics.totalProjectsPublished).toBe('number');
    expect(typeof metrics.totalTagsInUse).toBe('number');
    expect(typeof metrics.pageviews30d).toBe('number');
    expect(typeof metrics.lastCalculatedAt).toBe('string');
  });

  it('post items do NOT expose authorEmail or ipHash (sensitive fields)', async () => {
    const response = await app.request('/developer/profile');
    const body = (await response.json()) as { data: unknown };
    const bodyText = JSON.stringify(body.data);

    expect(bodyText).not.toContain('authorEmail');
    expect(bodyText).not.toContain('ipHash');
    expect(bodyText).not.toContain('renderedContent');
    expect(bodyText).not.toContain('deletedAt');
  });

  it('calls getDeveloperProfile service once per request', async () => {
    await app.request('/developer/profile');

    expect(getDeveloperProfileMock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when service throws an unexpected error', async () => {
    getDeveloperProfileMock.mockRejectedValueOnce(new Error('DB connection failed'));

    // Attach a minimal error handler to simulate production behaviour
    app.onError((err, c) =>
      c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500)
    );

    const response = await app.request('/developer/profile');
    expect(response.status).toBe(500);

    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
