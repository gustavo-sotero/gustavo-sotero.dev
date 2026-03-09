import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cachedMock,
  invalidatePatternMock,
  findManyTagsMock,
  findTagByIdMock,
  findTagByNameMock,
  tagNameExistsMock,
  tagSlugExistsMock,
  createTagMock,
  updateTagMock,
  deleteTagMock,
  countHighlightedByCategoryMock,
  syncPostTagsMock,
  syncProjectTagsMock,
} = vi.hoisted(() => ({
  cachedMock: vi.fn(),
  invalidatePatternMock: vi.fn(),
  findManyTagsMock: vi.fn(),
  findTagByIdMock: vi.fn(),
  findTagByNameMock: vi.fn(),
  tagNameExistsMock: vi.fn(),
  tagSlugExistsMock: vi.fn(),
  createTagMock: vi.fn(),
  updateTagMock: vi.fn(),
  deleteTagMock: vi.fn(),
  countHighlightedByCategoryMock: vi.fn(),
  syncPostTagsMock: vi.fn(),
  syncProjectTagsMock: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  cached: cachedMock,
  invalidatePattern: invalidatePatternMock,
}));

vi.mock('../repositories/tags.repo', () => ({
  findManyTags: findManyTagsMock,
  findTagById: findTagByIdMock,
  findTagByName: findTagByNameMock,
  tagNameExists: tagNameExistsMock,
  tagSlugExists: tagSlugExistsMock,
  createTag: createTagMock,
  updateTag: updateTagMock,
  countHighlightedByCategory: countHighlightedByCategoryMock,
  deleteTag: deleteTagMock,
  syncPostTags: syncPostTagsMock,
  syncProjectTags: syncProjectTagsMock,
}));

import { createTagService, deleteTagService, syncTags, updateTagService } from './tags.service';

describe('tags service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation((_key: string, _ttl: number, fetcher: () => unknown) =>
      fetcher()
    );
    tagSlugExistsMock.mockResolvedValue(false);
    // Default: no highlighted tags in any category
    countHighlightedByCategoryMock.mockResolvedValue(0);
  });

  it('throws conflict when creating tag with duplicated name', async () => {
    findTagByNameMock.mockResolvedValue({ id: 10, name: 'React' });

    await expect(createTagService({ name: 'React', category: 'framework' })).rejects.toThrow(
      'CONFLICT:'
    );

    expect(createTagMock).not.toHaveBeenCalled();
  });

  it('throws conflict when updating tag with duplicated name', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 1,
      name: 'React',
      slug: 'react',
      category: 'framework',
    });
    tagNameExistsMock.mockResolvedValue(true);

    await expect(updateTagService(1, { name: 'TypeScript' })).rejects.toThrow('CONFLICT:');

    expect(updateTagMock).not.toHaveBeenCalled();
  });

  // Plan §13.2.3 — iconKey auto-resolved on create (no manual input)
  it('auto-resolves iconKey when creating a tag without an explicit icon', async () => {
    tagNameExistsMock.mockResolvedValue(false);
    findTagByNameMock.mockResolvedValue(null);
    tagSlugExistsMock.mockResolvedValue(false);
    const created = {
      id: 5,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      iconKey: 'si:SiTypescript',
      createdAt: new Date(),
    };
    createTagMock.mockResolvedValue(created);

    const result = await createTagService({
      name: 'TypeScript',
      category: 'language',
    });

    // Service resolves the icon automatically — never needs caller to supply it
    expect(createTagMock).toHaveBeenCalledWith(
      expect.objectContaining({ iconKey: 'si:SiTypescript' })
    );
    expect(result).toMatchObject({ iconKey: 'si:SiTypescript' });
  });

  // Plan §13.2.3 — iconKey auto-resolved on update
  it('auto-resolves iconKey when updating a tag name', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 2,
      name: 'Docker',
      slug: 'docker',
      category: 'tool',
      iconKey: null,
    });
    tagNameExistsMock.mockResolvedValue(false);
    updateTagMock.mockResolvedValue({
      id: 2,
      name: 'Docker',
      slug: 'docker',
      category: 'tool',
      iconKey: 'si:SiDocker',
    });

    // Caller does NOT supply iconKey — service resolves it automatically
    await updateTagService(2, { name: 'Docker' });

    expect(updateTagMock).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ iconKey: 'si:SiDocker' })
    );
  });

  it('recalculates iconKey when category changes and no specific mapping exists', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 12,
      name: 'UnknownStack',
      slug: 'unknownstack',
      category: 'framework',
      iconKey: 'lucide:Layers',
      isHighlighted: false,
    });
    updateTagMock.mockResolvedValue({
      id: 12,
      name: 'UnknownStack',
      slug: 'unknownstack',
      category: 'infra',
      iconKey: 'lucide:Server',
      isHighlighted: false,
    });

    await updateTagService(12, { category: 'infra' });

    expect(updateTagMock).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ category: 'infra', iconKey: 'lucide:Server' })
    );
  });

  it('regenerates slug and invalidates related caches on name update', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 1,
      name: 'React',
      slug: 'react',
      category: 'framework',
    });
    tagNameExistsMock.mockResolvedValue(false);
    tagSlugExistsMock.mockResolvedValue(false);
    updateTagMock.mockResolvedValue({ id: 1, name: 'TypeScript', slug: 'typescript' });

    await updateTagService(1, { name: 'TypeScript' });

    expect(updateTagMock).toHaveBeenCalledWith(1, expect.objectContaining({ slug: 'typescript' }));
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
  });

  it('invalidates both resource and tags caches when syncing post tags', async () => {
    syncPostTagsMock.mockResolvedValue(undefined);

    await syncTags('post', 5, [1, 2]);

    expect(syncPostTagsMock).toHaveBeenCalledWith(5, [1, 2]);
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
  });

  it('invalidates both resource and tags caches when syncing project tags', async () => {
    syncProjectTagsMock.mockResolvedValue(undefined);

    await syncTags('project', 9, [3]);

    expect(syncProjectTagsMock).toHaveBeenCalledWith(9, [3]);
    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
  });

  // ── Highlight limit (max 2 per category) ─────────────────────────────────────

  it('allows creating a highlighted tag when category has fewer than 2 highlights', async () => {
    findTagByNameMock.mockResolvedValue(null);
    tagSlugExistsMock.mockResolvedValue(false);
    countHighlightedByCategoryMock.mockResolvedValue(1); // only 1 currently highlighted

    const created = {
      id: 7,
      name: 'Hono',
      slug: 'hono',
      category: 'framework',
      iconKey: 'si:SiHono',
      isHighlighted: true,
      createdAt: new Date(),
    };
    createTagMock.mockResolvedValue(created);

    const result = await createTagService({
      name: 'Hono',
      category: 'framework',
      isHighlighted: true,
    });

    expect(createTagMock).toHaveBeenCalledWith(expect.objectContaining({ isHighlighted: true }));
    expect(result?.isHighlighted).toBe(true);
  });

  it('throws HIGHLIGHT_LIMIT when creating a 3rd highlighted tag in the same category', async () => {
    findTagByNameMock.mockResolvedValue(null);
    countHighlightedByCategoryMock.mockResolvedValue(2); // already at the limit

    await expect(
      createTagService({ name: 'Express', category: 'framework', isHighlighted: true })
    ).rejects.toThrow('HIGHLIGHT_LIMIT:');

    expect(createTagMock).not.toHaveBeenCalled();
  });

  it('does not check highlight limit when creating a non-highlighted tag', async () => {
    findTagByNameMock.mockResolvedValue(null);
    tagSlugExistsMock.mockResolvedValue(false);
    const created = {
      id: 8,
      name: 'Fastify',
      slug: 'fastify',
      category: 'framework',
      iconKey: null,
      isHighlighted: false,
      createdAt: new Date(),
    };
    createTagMock.mockResolvedValue(created);

    await createTagService({ name: 'Fastify', category: 'framework', isHighlighted: false });

    expect(countHighlightedByCategoryMock).not.toHaveBeenCalled();
    expect(createTagMock).toHaveBeenCalled();
  });

  it('allows setting isHighlighted=true on update when category has room', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 3,
      name: 'Next.js',
      slug: 'nextjs',
      category: 'framework',
      isHighlighted: false,
    });
    countHighlightedByCategoryMock.mockResolvedValue(1); // 1 other highlighted in framework
    updateTagMock.mockResolvedValue({
      id: 3,
      name: 'Next.js',
      slug: 'nextjs',
      category: 'framework',
      isHighlighted: true,
    });

    const result = await updateTagService(3, { isHighlighted: true });

    expect(updateTagMock).toHaveBeenCalledWith(3, expect.objectContaining({ isHighlighted: true }));
    expect(result?.isHighlighted).toBe(true);
  });

  it('throws HIGHLIGHT_LIMIT when setting isHighlighted=true on update if category is full', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 3,
      name: 'Next.js',
      slug: 'nextjs',
      category: 'framework',
      isHighlighted: false,
    });
    countHighlightedByCategoryMock.mockResolvedValue(2); // already at limit (excludes self)

    await expect(updateTagService(3, { isHighlighted: true })).rejects.toThrow('HIGHLIGHT_LIMIT:');

    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it('allows removing highlight (isHighlighted=false) regardless of category count', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 4,
      name: 'React',
      slug: 'react',
      category: 'framework',
      isHighlighted: true,
    });
    countHighlightedByCategoryMock.mockResolvedValue(2); // category is full, but we are removing
    updateTagMock.mockResolvedValue({
      id: 4,
      name: 'React',
      slug: 'react',
      category: 'framework',
      isHighlighted: false,
    });

    const result = await updateTagService(4, { isHighlighted: false });

    // Should not throw; count check only happens when final state is highlighted
    expect(updateTagMock).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ isHighlighted: false })
    );
    expect(result?.isHighlighted).toBe(false);
  });

  it('validates target category when a highlighted tag changes category', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 5,
      name: 'PostgreSQL',
      slug: 'postgresql',
      category: 'db',
      isHighlighted: true,
    });
    // The new target category (language) already has 2 highlights
    countHighlightedByCategoryMock.mockResolvedValue(2);

    await expect(updateTagService(5, { category: 'language' })).rejects.toThrow('HIGHLIGHT_LIMIT:');

    expect(updateTagMock).not.toHaveBeenCalled();
  });

  // ── deleteTagService ─────────────────────────────────────────────────────────

  it('returns null when deleting a tag that does not exist', async () => {
    findTagByIdMock.mockResolvedValue(null);

    const result = await deleteTagService(999);

    expect(result).toBeNull();
    expect(deleteTagMock).not.toHaveBeenCalled();
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });

  it('deletes an existing tag and invalidates all related caches', async () => {
    findTagByIdMock.mockResolvedValue({ id: 10, name: 'Docker', slug: 'docker', category: 'tool' });
    deleteTagMock.mockResolvedValue({ id: 10 });

    const result = await deleteTagService(10);

    expect(deleteTagMock).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({ id: 10 });
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
  });

  it('returns null when deleteTag repo call returns nothing (already gone)', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 11,
      name: 'Orphan',
      slug: 'orphan',
      category: 'other',
    });
    deleteTagMock.mockResolvedValue(null);

    const result = await deleteTagService(11);

    expect(deleteTagMock).toHaveBeenCalledWith(11);
    expect(result).toBeNull();
    // No cache invalidation if delete didn't remove anything
    expect(invalidatePatternMock).not.toHaveBeenCalled();
  });
});
