import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dbLimitMock,
  invalidatePatternMock,
  renderMarkdownMock,
  createPostMock,
  updatePostMock,
  softDeletePostMock,
  syncPostTagsMock,
  createProjectMock,
  updateProjectMock,
  softDeleteProjectMock,
  syncProjectTagsMock,
} = vi.hoisted(() => ({
  dbLimitMock: vi.fn(),
  invalidatePatternMock: vi.fn(),
  renderMarkdownMock: vi.fn(),
  createPostMock: vi.fn(),
  updatePostMock: vi.fn(),
  softDeletePostMock: vi.fn(),
  syncPostTagsMock: vi.fn(),
  createProjectMock: vi.fn(),
  updateProjectMock: vi.fn(),
  softDeleteProjectMock: vi.fn(),
  syncProjectTagsMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: dbLimitMock,
        })),
      })),
    })),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  },
}));

vi.mock('../lib/cache', () => ({
  cached: vi.fn((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidatePattern: invalidatePatternMock,
  invalidateGroup: vi.fn(async (group: string) => {
    if (group === 'postsContent') {
      await invalidatePatternMock('posts:*');
      await invalidatePatternMock('tags:*');
      await invalidatePatternMock('feed:*');
      await invalidatePatternMock('sitemap:*');
      await invalidatePatternMock('developer:profile');
    }
    if (group === 'projectsContent') {
      await invalidatePatternMock('projects:*');
      await invalidatePatternMock('tags:*');
      await invalidatePatternMock('feed:*');
      await invalidatePatternMock('sitemap:*');
      await invalidatePatternMock('developer:profile');
    }
  }),
}));

vi.mock('../lib/markdown', () => ({
  renderMarkdown: renderMarkdownMock,
}));

vi.mock('../repositories/posts.repo', () => ({
  createPost: createPostMock,
  updatePost: updatePostMock,
  softDeletePost: softDeletePostMock,
  findManyPosts: vi.fn(),
  findPostBySlug: vi.fn(),
}));

vi.mock('../repositories/projects.repo', () => ({
  createProject: createProjectMock,
  updateProject: updateProjectMock,
  softDeleteProject: softDeleteProjectMock,
  findManyProjects: vi.fn(),
  findProjectBySlug: vi.fn(),
}));

vi.mock('../repositories/comments.repo', () => ({
  findApprovedCommentsByPostId: vi.fn(),
}));

vi.mock('../repositories/tags.repo', () => ({
  syncPostTags: syncPostTagsMock,
  syncProjectTags: syncProjectTagsMock,
  syncPostTagsInTx: vi.fn(),
  syncProjectTagsInTx: vi.fn(),
}));

import { createPostService, softDeletePostService, updatePostService } from './posts.service';
import {
  createProjectService,
  softDeleteProjectService,
  updateProjectService,
} from './projects.service';

describe('content services cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderMarkdownMock.mockResolvedValue('<p>rendered</p>');
  });

  it('invalidates posts and tags caches when creating a post', async () => {
    dbLimitMock.mockResolvedValueOnce([]);
    createPostMock.mockResolvedValueOnce({ id: 1, slug: 'novo-post' });

    await createPostService({
      title: 'Novo Post',
      content: 'Conteúdo',
      status: 'draft',
    });

    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });

  it('invalidates posts and tags caches when updating a post', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 1, slug: 'post-antigo', publishedAt: null }]);
    updatePostMock.mockResolvedValueOnce({ id: 1, slug: 'post-antigo' });

    await updatePostService(1, { content: 'Conteúdo atualizado' });

    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });

  it('invalidates posts and tags caches when soft-deleting a post', async () => {
    // softDeletePostService first fetches the post to check if it was scheduled
    dbLimitMock.mockResolvedValueOnce([{ id: 1, status: 'draft' }]);
    softDeletePostMock.mockResolvedValueOnce({ id: 1 });

    await softDeletePostService(1);

    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });

  it('invalidates projects and tags caches when creating a project', async () => {
    dbLimitMock.mockResolvedValueOnce([]);
    createProjectMock.mockResolvedValueOnce({ id: 10, slug: 'novo-projeto' });

    await createProjectService({
      title: 'Novo Projeto',
      content: 'Conteúdo',
      status: 'draft',
      featured: false,
      order: 0,
    });

    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });

  it('invalidates projects and tags caches when updating a project', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 10, slug: 'projeto-antigo' }]);
    updateProjectMock.mockResolvedValueOnce({ id: 10, slug: 'projeto-antigo' });

    await updateProjectService(10, { content: 'Conteúdo atualizado' });

    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });

  it('invalidates projects and tags caches when soft-deleting a project', async () => {
    softDeleteProjectMock.mockResolvedValueOnce({ id: 10 });

    await softDeleteProjectService(10);

    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('feed:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('sitemap:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('developer:profile');
  });
});
