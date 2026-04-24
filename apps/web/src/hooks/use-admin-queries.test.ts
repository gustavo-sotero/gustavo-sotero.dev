/**
 * Tests: admin mutation hooks call revalidatePublicTags on success,
 * and a failure in revalidation does NOT interrupt the mutation success flow.
 *
 * Plan §8.1 — hooks admin:
 *  - no `onSuccess`, chama helper de revalidate
 *  - falha de revalidate não interrompe fluxo de sucesso
 */
import type { Post, Project, Skill, Tag } from '@portfolio/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (declared before imports of modules under test) ────────────────────

const mockRevalidatePublicTags = vi
  .fn<(tags: string[]) => Promise<void>>()
  .mockResolvedValue(undefined);
vi.mock('@/lib/actions/revalidate-tags', () => ({
  revalidatePublicTags: (...args: [string[]]) => mockRevalidatePublicTags(...args),
}));

const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();
const mockApiGet = vi.fn();
const mockApiGetPaginated = vi.fn();
const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiGetPaginated: (...args: unknown[]) => mockApiGetPaginated(...args),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────
const { useCreatePost, useUpdatePost, useDeletePost } = await import('./admin/use-admin-posts');

const { useCreateProject, useUpdateProject, useDeleteProject } = await import(
  './admin/use-admin-projects'
);

const { useCreateTag, useUpdateTag, useDeleteTag } = await import('./admin/use-admin-tags');

const { useCreateSkill, useUpdateSkill, useDeleteSkill } = await import('./admin/use-admin-skills');

const {
  useAdminUpdateCommentStatus,
  useApproveComment,
  useRejectComment,
  useAdminReplyComment,
  useAdminEditCommentContent,
  useAdminDeleteComment,
} = await import('./admin/use-admin-comments');

const {
  TAG_EXPERIENCE_LIST,
  postMutationTags,
  postMutationTagsWithSlugTransition,
  projectMutationTags,
  projectMutationTagsWithSlugTransition,
  skillMutationTags,
  tagMutationTags,
} = await import('@/lib/data/public/cache-tags');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    slug: 'my-post',
    title: 'My Post',
    content: '# My Post',
    renderedContent: '<h1>My Post</h1>',
    excerpt: null,
    coverUrl: null,
    status: 'published',
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    scheduledAt: null,
    tags: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'my-project',
    title: 'My Project',
    description: 'A project',
    content: '# Project',
    renderedContent: '<h1>Project</h1>',
    coverUrl: null,
    status: 'published',
    repositoryUrl: null,
    liveUrl: null,
    featured: false,
    order: 0,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    impactFacts: [],
    tags: [],
    ...overrides,
  };
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'language',
    iconKey: 'si:SiTypescript',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'language',
    iconKey: 'si:SiTypescript',
    expertiseLevel: 3,
    isHighlighted: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('admin mutation hooks — revalidation on success', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tagMutationTags includes experience-backed public cache tags', () => {
    expect(tagMutationTags()).toContain(TAG_EXPERIENCE_LIST);
  });

  // ── Posts ──────────────────────────────────────────────────────────────────

  describe('useCreatePost', () => {
    it('calls revalidatePublicTags with post mutation tags on success', async () => {
      const post = makePost();
      mockApiPost.mockResolvedValueOnce({ success: true, data: post });

      const { result } = renderHook(() => useCreatePost(), { wrapper: wrapper(qc) });
      result.current.mutate({ title: 'My Post', content: '# My Post', status: 'published' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(postMutationTags());
    });

    it('mutation success is not blocked when revalidatePublicTags rejects', async () => {
      const post = makePost();
      mockApiPost.mockResolvedValueOnce({ success: true, data: post });
      mockRevalidatePublicTags.mockRejectedValueOnce(new Error('Cache unavailable'));

      const { result } = renderHook(() => useCreatePost(), { wrapper: wrapper(qc) });
      result.current.mutate({ title: 'My Post', content: '# My Post', status: 'published' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useUpdatePost', () => {
    it('calls revalidatePublicTags with previous and current post slug tags on success', async () => {
      const post = makePost({ slug: 'updated-slug' });
      mockApiPatch.mockResolvedValueOnce({ success: true, data: post });

      const { result } = renderHook(() => useUpdatePost(1, 'old-slug'), { wrapper: wrapper(qc) });
      result.current.mutate({ title: 'Updated Title', status: 'published' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(
        postMutationTagsWithSlugTransition('old-slug', 'updated-slug')
      );
    });
  });

  describe('useDeletePost', () => {
    it('calls revalidatePublicTags with post mutation tags on success', async () => {
      mockApiDelete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useDeletePost(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 42, slug: 'my-post' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(postMutationTags('my-post'));
    });
  });

  // ── Projects ───────────────────────────────────────────────────────────────

  describe('useCreateProject', () => {
    it('calls revalidatePublicTags with project mutation tags on success', async () => {
      const project = makeProject();
      mockApiPost.mockResolvedValueOnce({ success: true, data: project });

      const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(qc) });
      result.current.mutate({
        title: 'My Project',
        content: '# Project',
        status: 'published',
        slug: 'my-project',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(projectMutationTags());
    });

    it('mutation success is not blocked when revalidatePublicTags rejects', async () => {
      const project = makeProject();
      mockApiPost.mockResolvedValueOnce({ success: true, data: project });
      mockRevalidatePublicTags.mockRejectedValueOnce(new Error('Cache unavailable'));

      const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(qc) });
      result.current.mutate({
        title: 'My Project',
        content: '# Project',
        status: 'published',
        slug: 'my-project',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useUpdateProject', () => {
    it('calls revalidatePublicTags with previous and current project slug tags on success', async () => {
      const project = makeProject({ slug: 'updated-project' });
      mockApiPatch.mockResolvedValueOnce({ success: true, data: project });

      const { result } = renderHook(() => useUpdateProject(1, 'old-project'), {
        wrapper: wrapper(qc),
      });
      result.current.mutate({ title: 'Updated Project' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(
        projectMutationTagsWithSlugTransition('old-project', 'updated-project')
      );
    });
  });

  describe('useDeleteProject', () => {
    it('calls revalidatePublicTags with project mutation tags on success', async () => {
      mockApiDelete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useDeleteProject(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 7, slug: 'my-project' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(projectMutationTags('my-project'));
    });
  });

  // ── Tags ───────────────────────────────────────────────────────────────────

  describe('useCreateTag', () => {
    it('calls revalidatePublicTags with all tag mutation tags on success', async () => {
      const tag = makeTag();
      mockApiPost.mockResolvedValueOnce({ success: true, data: tag });

      const { result } = renderHook(() => useCreateTag(), { wrapper: wrapper(qc) });
      result.current.mutate({ name: 'TypeScript', category: 'language' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(tagMutationTags());
    });

    it('mutation success is not blocked when revalidatePublicTags rejects', async () => {
      const tag = makeTag();
      mockApiPost.mockResolvedValueOnce({ success: true, data: tag });
      mockRevalidatePublicTags.mockRejectedValueOnce(new Error('Cache down'));

      const { result } = renderHook(() => useCreateTag(), { wrapper: wrapper(qc) });
      result.current.mutate({ name: 'TypeScript', category: 'language' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useUpdateTag', () => {
    it('calls revalidatePublicTags with tag mutation tags on success', async () => {
      const tag = makeTag();
      mockApiPatch.mockResolvedValueOnce({ success: true, data: tag });

      const { result } = renderHook(() => useUpdateTag(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 1, data: { name: 'TypeScript Renamed' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(tagMutationTags());
    });
  });

  describe('useDeleteTag', () => {
    it('calls revalidatePublicTags with tag mutation tags on success', async () => {
      mockApiDelete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useDeleteTag(), { wrapper: wrapper(qc) });
      result.current.mutate(3);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(tagMutationTags());
    });
  });

  // ── Skills ───────────────────────────────────────────────────────────────

  describe('useCreateSkill', () => {
    it('calls revalidatePublicTags with all skill-dependent public cache tags on success', async () => {
      const skill = makeSkill();
      mockApiPost.mockResolvedValueOnce({ success: true, data: skill });

      const { result } = renderHook(() => useCreateSkill(), { wrapper: wrapper(qc) });
      result.current.mutate({
        name: 'TypeScript',
        category: 'language',
        expertiseLevel: 3,
        isHighlighted: true,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(skillMutationTags());
    });
  });

  describe('useUpdateSkill', () => {
    it('calls revalidatePublicTags with all skill-dependent public cache tags on success', async () => {
      const skill = makeSkill({ name: 'TypeScript Updated' });
      mockApiPatch.mockResolvedValueOnce({ success: true, data: skill });

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper(qc) });
      result.current.mutate({
        id: 1,
        data: { name: 'TypeScript Updated', expertiseLevel: 2 },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(skillMutationTags());
    });
  });

  describe('useDeleteSkill', () => {
    it('calls revalidatePublicTags with all skill-dependent public cache tags on success', async () => {
      mockApiDelete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useDeleteSkill(), { wrapper: wrapper(qc) });
      result.current.mutate(4);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRevalidatePublicTags).toHaveBeenCalledWith(skillMutationTags());
    });
  });
});

// ─── Admin comment mutation hooks ─────────────────────────────────────────────

function makeAdminComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cccc-cccc',
    postId: 1,
    postTitle: 'My Post',
    authorName: 'Test User',
    authorEmail: 'test@example.com',
    authorRole: 'guest' as const,
    content: 'A comment',
    renderedContent: '<p>A comment</p>',
    status: 'pending' as const,
    ipHash: 'abc123',
    parentCommentId: null,
    editedAt: null,
    editedBy: null,
    editReason: null,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    createdAt: new Date().toISOString(),
    moderatedAt: null,
    moderatedBy: null,
    ...overrides,
  };
}

describe('admin comment mutation hooks — API calls and query invalidation', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── useAdminUpdateCommentStatus ──────────────────────────────────────────────

  describe('useAdminUpdateCommentStatus', () => {
    it('calls apiPatch with correct endpoint and payload on APPROVE', async () => {
      const comment = makeAdminComment({ status: 'approved' });
      mockApiPatch.mockResolvedValueOnce({ success: true, data: comment });

      const { result } = renderHook(() => useAdminUpdateCommentStatus(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'cccc-cccc', status: 'approved' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/admin/comments/cccc-cccc/status',
        expect.objectContaining({ status: 'approved' })
      );
    });

    it('invalidates admin comments queries on settled', async () => {
      mockApiPatch.mockResolvedValueOnce({ success: true, data: makeAdminComment() });
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

      const { result } = renderHook(() => useAdminUpdateCommentStatus(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'dddd-dddd', status: 'rejected' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['admin', 'comments'] })
      );
    });
  });

  // ── useApproveComment (legacy) ────────────────────────────────────────────────

  describe('useApproveComment', () => {
    it('calls apiPost on the legacy approve endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useApproveComment(), { wrapper: wrapper(qc) });
      result.current.mutate('eeee-eeee');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiPost).toHaveBeenCalledWith('/admin/comments/eeee-eeee/approve', {});
    });

    it('invalidates admin comments queries on settled', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

      const { result } = renderHook(() => useApproveComment(), { wrapper: wrapper(qc) });
      result.current.mutate('eeee-eeee');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['admin', 'comments'] })
      );
    });
  });

  // ── useRejectComment (legacy) ─────────────────────────────────────────────────

  describe('useRejectComment', () => {
    it('calls apiPost on the legacy reject endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useRejectComment(), { wrapper: wrapper(qc) });
      result.current.mutate('ffff-ffff');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiPost).toHaveBeenCalledWith('/admin/comments/ffff-ffff/reject', {});
    });
  });

  // ── useAdminReplyComment ──────────────────────────────────────────────────────

  describe('useAdminReplyComment', () => {
    it('calls apiPost with the reply payload', async () => {
      const newComment = makeAdminComment({ authorRole: 'admin', parentCommentId: 'pppp-pppp' });
      mockApiPost.mockResolvedValueOnce({ success: true, data: newComment });

      const { result } = renderHook(() => useAdminReplyComment(), { wrapper: wrapper(qc) });
      result.current.mutate({
        postId: 1,
        parentCommentId: 'pppp-pppp',
        content: 'Admin reply content',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiPost).toHaveBeenCalledWith('/admin/comments/reply', {
        postId: 1,
        parentCommentId: 'pppp-pppp',
        content: 'Admin reply content',
      });
    });

    it('invalidates admin comments queries on success', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true, data: makeAdminComment() });
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

      const { result } = renderHook(() => useAdminReplyComment(), { wrapper: wrapper(qc) });
      result.current.mutate({ postId: 2, parentCommentId: 'pppp-pppp', content: 'Reply' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['admin', 'comments'] })
      );
    });
  });

  // ── useAdminEditCommentContent ────────────────────────────────────────────────

  describe('useAdminEditCommentContent', () => {
    it('calls apiPatch with edited content payload', async () => {
      const updated = makeAdminComment({ content: 'Edited content' });
      mockApiPatch.mockResolvedValueOnce({ success: true, data: updated });

      const { result } = renderHook(() => useAdminEditCommentContent(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'gggg-gggg', content: 'Edited content', reason: 'Typo fix' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiPatch).toHaveBeenCalledWith('/admin/comments/gggg-gggg/content', {
        content: 'Edited content',
        reason: 'Typo fix',
      });
    });

    it('invalidates admin comments queries on success', async () => {
      mockApiPatch.mockResolvedValueOnce({ success: true, data: makeAdminComment() });
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

      const { result } = renderHook(() => useAdminEditCommentContent(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'hhhh-hhhh', content: 'Some content' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['admin', 'comments'] })
      );
    });
  });

  // ── useAdminDeleteComment ─────────────────────────────────────────────────────

  describe('useAdminDeleteComment', () => {
    it('calls apiFetch with DELETE method and comment id', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true, data: makeAdminComment() });

      const { result } = renderHook(() => useAdminDeleteComment(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'iiii-iiii', reason: 'Spam' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/admin/comments/iiii-iiii',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('invalidates admin comments queries on settled', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true, data: makeAdminComment() });
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

      const { result } = renderHook(() => useAdminDeleteComment(), { wrapper: wrapper(qc) });
      result.current.mutate({ id: 'jjjj-jjjj' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['admin', 'comments'] })
      );
    });
  });
});
