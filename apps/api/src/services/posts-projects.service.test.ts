import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dbLimitMock,
  renderMarkdownMock,
  createPostMock,
  updatePostMock,
  findPostBySlugMock,
  findApprovedCommentsByPostIdMock,
  createProjectMock,
  updateProjectMock,
  findManyProjectsMock,
  findProjectBySlugMock,
  enqueueScheduledPostPublishMock,
  cancelScheduledPostPublishMock,
} = vi.hoisted(() => ({
  dbLimitMock: vi.fn(),
  renderMarkdownMock: vi.fn(),
  createPostMock: vi.fn(),
  updatePostMock: vi.fn(),
  findPostBySlugMock: vi.fn(),
  findApprovedCommentsByPostIdMock: vi.fn(),
  createProjectMock: vi.fn(),
  updateProjectMock: vi.fn(),
  findManyProjectsMock: vi.fn(),
  findProjectBySlugMock: vi.fn(),
  enqueueScheduledPostPublishMock: vi.fn(),
  cancelScheduledPostPublishMock: vi.fn(),
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
    // Passes an empty-ish tx; all DB operations inside the transaction
    // are intercepted by the repo mocks above, so tx methods are never called.
    // The insert stub is provided for outbox operations in scheduled-post tests.
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      })
    ),
  },
}));

vi.mock('../lib/cache', () => ({
  cached: vi.fn((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidatePattern: vi.fn(),
}));

vi.mock('../lib/markdown', () => ({
  renderMarkdown: renderMarkdownMock,
}));

vi.mock('../repositories/comments.repo', () => ({
  findApprovedCommentsByPostId: findApprovedCommentsByPostIdMock,
}));

vi.mock('../repositories/posts.repo', () => ({
  createPost: createPostMock,
  updatePost: updatePostMock,
  softDeletePost: vi.fn(),
  findManyPosts: vi.fn(),
  findPostBySlug: findPostBySlugMock,
}));

vi.mock('../repositories/projects.repo', () => ({
  createProject: createProjectMock,
  updateProject: updateProjectMock,
  softDeleteProject: vi.fn(),
  findManyProjects: findManyProjectsMock,
  findProjectBySlug: findProjectBySlugMock,
}));

vi.mock('../repositories/tags.repo', () => ({
  syncPostTags: vi.fn(),
  syncProjectTags: vi.fn(),
  syncPostTagsInTx: vi.fn(),
  syncProjectTagsInTx: vi.fn(),
}));

vi.mock('../lib/queues', () => ({
  enqueueScheduledPostPublish: enqueueScheduledPostPublishMock,
  cancelScheduledPostPublish: cancelScheduledPostPublishMock,
}));

import { cached } from '../lib/cache';
import {
  createPostService,
  getPostBySlug,
  softDeletePostService,
  updatePostService,
} from './posts.service';
import {
  createProjectService,
  getProjectBySlug,
  listProjects,
  updateProjectService,
} from './projects.service';

describe('posts/projects services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderMarkdownMock.mockResolvedValue('<p>rendered</p>');
  });

  it('createPostService gera slug único com sufixo numérico em colisão', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([]);
    createPostMock.mockResolvedValueOnce({ id: 1, slug: 'meu-post-1' });

    await createPostService({
      title: 'Meu Post',
      content: 'conteudo',
      status: 'draft',
    });

    expect(createPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'meu-post-1',
        renderedContent: '<p>rendered</p>',
      }),
      expect.anything()
    );
  });

  it('updatePostService define publishedAt ao publicar post em draft', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 1, slug: 'post-a', publishedAt: null }]);
    updatePostMock.mockResolvedValueOnce({ id: 1, slug: 'post-a' });

    await updatePostService(1, { status: 'published' });

    expect(updatePostMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
      }),
      expect.anything()
    );
  });

  it('updatePostService lança conflito em slug duplicado', async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ id: 1, slug: 'post-a', publishedAt: null }])
      .mockResolvedValueOnce([{ id: 2 }]);

    await expect(updatePostService(1, { slug: 'slug-existente' })).rejects.toThrow('CONFLICT:');
    expect(updatePostMock).not.toHaveBeenCalled();
  });

  it('createProjectService renderiza markdown em write-time', async () => {
    dbLimitMock.mockResolvedValueOnce([]);
    createProjectMock.mockResolvedValueOnce({ id: 1, slug: 'projeto-a' });

    await createProjectService({
      title: 'Projeto A',
      content: '# Título',
      status: 'draft',
      featured: false,
      order: 0,
    });

    expect(createProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedContent: '<p>rendered</p>',
      }),
      expect.anything()
    );
  });

  it('updateProjectService atualiza renderedContent quando content muda', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 1, slug: 'projeto-a' }]);
    updateProjectMock.mockResolvedValueOnce({ id: 1, slug: 'projeto-a' });

    await updateProjectService(1, { content: 'novo conteúdo' });

    expect(updateProjectMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        content: 'novo conteúdo',
        renderedContent: '<p>rendered</p>',
      }),
      expect.anything()
    );
  });

  it('getPostBySlug (admin) retorna tags achatadas em Tag[]', async () => {
    findPostBySlugMock.mockResolvedValueOnce({
      id: 1,
      slug: 'post-a',
      tags: [
        { postId: 1, tagId: 2, tag: { id: 2, name: 'TypeScript', slug: 'typescript' } },
        { postId: 1, tagId: 3, tag: { id: 3, name: 'Bun', slug: 'bun' } },
      ],
    });

    const result = await getPostBySlug('post-a', true);

    expect(findPostBySlugMock).toHaveBeenCalledWith('post-a', true);
    expect(result).toEqual(
      expect.objectContaining({
        tags: [
          { id: 2, name: 'TypeScript', slug: 'typescript' },
          { id: 3, name: 'Bun', slug: 'bun' },
        ],
      })
    );
  });

  it('listProjects usa chaves de cache distintas com e sem featuredFirst', async () => {
    const emptyResult = { data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } };
    findManyProjectsMock.mockResolvedValue(emptyResult);

    const cachedSpy = vi.mocked(cached);

    await listProjects({ page: 1, perPage: 3 }, false);
    await listProjects({ page: 1, perPage: 3, featuredFirst: true }, false);

    const callsForListProjects = cachedSpy.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.startsWith('projects:list:')
    );
    expect(callsForListProjects).toHaveLength(2);

    const firstKey = callsForListProjects[0]?.[0] as string;
    const secondKey = callsForListProjects[1]?.[0] as string;

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).not.toContain('featuredFirst=true');
    expect(secondKey).toContain('featuredFirst=true');
  });

  it('getProjectBySlug (admin) retorna tags achatadas em Tag[]', async () => {
    findProjectBySlugMock.mockResolvedValueOnce({
      id: 1,
      slug: 'projeto-a',
      tags: [{ projectId: 1, tagId: 4, tag: { id: 4, name: 'React', slug: 'react' } }],
    });

    const result = await getProjectBySlug('projeto-a', true);

    expect(findProjectBySlugMock).toHaveBeenCalledWith('projeto-a', true);
    expect(result).toEqual(
      expect.objectContaining({ tags: [{ id: 4, name: 'React', slug: 'react' }] })
    );
  });

  // ── Scheduling tests ──────────────────────────────────────────────────────

  it('createPostService com status=scheduled persiste scheduledAt e enfileira job', async () => {
    dbLimitMock.mockResolvedValueOnce([]);
    createPostMock.mockResolvedValueOnce({ id: 42, slug: 'post-agendado' });
    enqueueScheduledPostPublishMock.mockResolvedValueOnce(undefined);

    const futureDate = new Date(Date.now() + 3_600_000); // +1 hora

    await createPostService({
      title: 'Post Agendado',
      content: 'conteudo',
      status: 'scheduled',
      scheduledAt: futureDate,
    });

    expect(createPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'scheduled',
        scheduledAt: futureDate,
        publishedAt: undefined,
      }),
      expect.anything()
    );
    // Scheduling is now handled via the outbox pattern (relay enqueues the job);
    // the service no longer calls enqueueScheduledPostPublish directly.
    expect(enqueueScheduledPostPublishMock).not.toHaveBeenCalled();
  });

  it('createPostService com status=draft não enfileira job', async () => {
    dbLimitMock.mockResolvedValueOnce([]);
    createPostMock.mockResolvedValueOnce({ id: 1, slug: 'rascunho' });

    await createPostService({ title: 'Rascunho', content: 'conteudo', status: 'draft' });

    expect(enqueueScheduledPostPublishMock).not.toHaveBeenCalled();
  });

  it('updatePostService transição draft→scheduled enfileira job e persiste scheduledAt', async () => {
    const futureDate = new Date(Date.now() + 7_200_000); // +2 horas
    dbLimitMock.mockResolvedValueOnce([
      { id: 5, slug: 'post-x', status: 'draft', publishedAt: null, scheduledAt: null },
    ]);
    updatePostMock.mockResolvedValueOnce({ id: 5, slug: 'post-x' });
    enqueueScheduledPostPublishMock.mockResolvedValueOnce(undefined);

    await updatePostService(5, { status: 'scheduled', scheduledAt: futureDate });

    expect(updatePostMock).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        status: 'scheduled',
        scheduledAt: futureDate,
        publishedAt: null,
      }),
      expect.anything()
    );
    // Scheduling is now handled via the outbox pattern (relay enqueues the job);
    // the service no longer calls enqueueScheduledPostPublish directly.
    expect(enqueueScheduledPostPublishMock).not.toHaveBeenCalled();
    expect(cancelScheduledPostPublishMock).not.toHaveBeenCalled();
  });

  it('updatePostService transição scheduled→published cancela job e define publishedAt', async () => {
    dbLimitMock.mockResolvedValueOnce([
      { id: 5, slug: 'post-x', status: 'scheduled', publishedAt: null, scheduledAt: new Date() },
    ]);
    updatePostMock.mockResolvedValueOnce({ id: 5, slug: 'post-x' });
    cancelScheduledPostPublishMock.mockResolvedValueOnce(undefined);

    await updatePostService(5, { status: 'published' });

    expect(updatePostMock).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
        scheduledAt: null,
      }),
      expect.anything()
    );
    expect(cancelScheduledPostPublishMock).toHaveBeenCalledWith(5);
    expect(enqueueScheduledPostPublishMock).not.toHaveBeenCalled();
  });

  it('updatePostService transição scheduled→draft cancela job e limpa scheduledAt', async () => {
    dbLimitMock.mockResolvedValueOnce([
      { id: 5, slug: 'post-x', status: 'scheduled', publishedAt: null, scheduledAt: new Date() },
    ]);
    updatePostMock.mockResolvedValueOnce({ id: 5, slug: 'post-x' });
    cancelScheduledPostPublishMock.mockResolvedValueOnce(undefined);

    await updatePostService(5, { status: 'draft' });

    expect(updatePostMock).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: 'draft', scheduledAt: null }),
      expect.anything()
    );
    expect(cancelScheduledPostPublishMock).toHaveBeenCalledWith(5);
  });

  it('softDeletePostService cancela job quando post estava scheduled', async () => {
    // First db.select for status check
    dbLimitMock.mockResolvedValueOnce([{ id: 7, status: 'scheduled' }]);
    const { softDeletePost } = await import('../repositories/posts.repo');
    vi.mocked(softDeletePost).mockResolvedValueOnce({ id: 7 });
    cancelScheduledPostPublishMock.mockResolvedValueOnce(undefined);

    await softDeletePostService(7);

    expect(cancelScheduledPostPublishMock).toHaveBeenCalledWith(7);
  });

  it('softDeletePostService não cancela job quando post estava em draft', async () => {
    dbLimitMock.mockResolvedValueOnce([{ id: 8, status: 'draft' }]);
    const { softDeletePost } = await import('../repositories/posts.repo');
    vi.mocked(softDeletePost).mockResolvedValueOnce({ id: 8 });

    await softDeletePostService(8);

    expect(cancelScheduledPostPublishMock).not.toHaveBeenCalled();
  });

  it('getPostBySlug (public) retorna árvore de comentários aprovados', async () => {
    const commentsTree = [
      {
        id: 'root-1',
        postId: 1,
        parentCommentId: null,
        authorName: 'Root',
        authorRole: 'guest' as const,
        content: 'Root content',
        renderedContent: '<p>Root content</p>',
        status: 'approved' as const,
        createdAt: '2026-02-01T00:00:00.000Z',
        replies: [
          {
            id: 'reply-1',
            postId: 1,
            parentCommentId: 'root-1',
            authorName: 'Admin',
            authorRole: 'admin' as const,
            content: 'Reply content',
            renderedContent: '<p>Reply content</p>',
            status: 'approved' as const,
            createdAt: '2026-02-01T01:00:00.000Z',
            replies: [],
          },
        ],
      },
    ];

    findPostBySlugMock.mockResolvedValueOnce({
      id: 1,
      slug: 'post-a',
      tags: [{ postId: 1, tagId: 2, tag: { id: 2, name: 'TypeScript', slug: 'typescript' } }],
    });
    findApprovedCommentsByPostIdMock.mockResolvedValueOnce(commentsTree);

    const result = await getPostBySlug('post-a', false);

    expect(findPostBySlugMock).toHaveBeenCalledWith('post-a', false);
    expect(findApprovedCommentsByPostIdMock).toHaveBeenCalledWith(1);
    expect(result).toEqual(
      expect.objectContaining({
        comments: commentsTree,
      })
    );
  });
});
