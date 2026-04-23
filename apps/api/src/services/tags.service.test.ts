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
  syncPostTagsMock: vi.fn(),
  syncProjectTagsMock: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  cached: cachedMock,
  invalidatePattern: invalidatePatternMock,
  invalidateGroup: vi.fn(async (group: string) => {
    if (group === 'tagsContent') {
      await invalidatePatternMock('tags:*');
      await invalidatePatternMock('posts:*');
      await invalidatePatternMock('projects:*');
    }
    if (group === 'postTagsSync') {
      await invalidatePatternMock('posts:*');
      await invalidatePatternMock('tags:*');
    }
    if (group === 'projectTagsSync') {
      await invalidatePatternMock('projects:*');
      await invalidatePatternMock('tags:*');
    }
  }),
}));

vi.mock('../repositories/tags.repo', () => ({
  findManyTags: findManyTagsMock,
  findTagById: findTagByIdMock,
  findTagByName: findTagByNameMock,
  tagNameExists: tagNameExistsMock,
  tagSlugExists: tagSlugExistsMock,
  createTag: createTagMock,
  updateTag: updateTagMock,
  deleteTag: deleteTagMock,
  syncPostTags: syncPostTagsMock,
  syncProjectTags: syncProjectTagsMock,
}));

import {
  createTagService,
  deleteTagService,
  listTags,
  syncTags,
  updateTagService,
} from './tags.service';

describe('tags service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation((_key: string, _ttl: number, fetcher: () => unknown) =>
      fetcher()
    );
    tagSlugExistsMock.mockResolvedValue(false);
  });

  it('uses a source-aware cache key for public tag listings to avoid collisions', async () => {
    const repoResult = {
      data: [
        {
          id: 1,
          name: 'TypeScript',
          slug: 'typescript',
          category: 'language',
          iconKey: 'si:SiTypescript',
          isHighlighted: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    findManyTagsMock.mockResolvedValue(repoResult);

    const result = await listTags({ category: 'language,framework', source: 'project' }, true);

    expect(cachedMock).toHaveBeenCalledWith(
      'tags:public:category=language,framework:source=project',
      300,
      expect.any(Function)
    );
    expect(findManyTagsMock).toHaveBeenCalledWith(
      { category: 'language,framework', source: 'project' },
      true
    );
    expect(result.meta).toEqual(repoResult.meta);
    expect(result.data[0]).toMatchObject({
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      iconKey: 'si:SiTypescript',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.data[0]).not.toHaveProperty('isHighlighted');
  });

  it('preserves legacy union semantics when source is absent on public listing', async () => {
    const repoResult = {
      data: [
        {
          id: 1,
          name: 'TypeScript',
          slug: 'typescript',
          category: 'language',
          iconKey: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    findManyTagsMock.mockResolvedValue(repoResult);

    await listTags({ category: 'language' }, true);

    expect(cachedMock).toHaveBeenCalledWith(
      'tags:public:category=language:source=',
      300,
      expect.any(Function)
    );
    expect(findManyTagsMock).toHaveBeenCalledWith({ category: 'language' }, true);
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
    expect(result).not.toHaveProperty('isHighlighted');
  });

  // Plan §13.2.3 — iconKey auto-resolved on update
  it('auto-resolves iconKey when updating a tag name', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 2,
      name: 'Docker',
      slug: 'docker',
      category: 'infra',
      iconKey: null,
    });
    tagNameExistsMock.mockResolvedValue(false);
    updateTagMock.mockResolvedValue({
      id: 2,
      name: 'Docker',
      slug: 'docker',
      category: 'infra',
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    updateTagMock.mockResolvedValue({
      id: 12,
      name: 'UnknownStack',
      slug: 'unknownstack',
      category: 'infra',
      iconKey: 'lucide:Server',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await updateTagService(12, { category: 'infra' });

    expect(updateTagMock).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ category: 'infra', iconKey: 'lucide:Server' })
    );
    expect(result).not.toHaveProperty('isHighlighted');
  });

  it('regenerates slug and invalidates related caches on name update', async () => {
    findTagByIdMock.mockResolvedValue({
      id: 1,
      name: 'React',
      slug: 'react',
      category: 'framework',
      iconKey: 'si:SiReact',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    tagNameExistsMock.mockResolvedValue(false);
    tagSlugExistsMock.mockResolvedValue(false);
    updateTagMock.mockResolvedValue({
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'framework',
      iconKey: 'si:SiTypescript',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await updateTagService(1, { name: 'TypeScript' });

    expect(updateTagMock).toHaveBeenCalledWith(1, expect.objectContaining({ slug: 'typescript' }));
    expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
    expect(invalidatePatternMock).toHaveBeenCalledWith('projects:*');
    expect(result).not.toHaveProperty('isHighlighted');
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

  it('strips legacy highlight metadata from create and update responses', async () => {
    findTagByNameMock.mockResolvedValueOnce(null);
    createTagMock.mockResolvedValueOnce({
      id: 7,
      name: 'Hono',
      slug: 'hono',
      category: 'framework',
      iconKey: 'si:SiHono',
      isHighlighted: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const created = await createTagService({ name: 'Hono', category: 'framework' });

    findTagByIdMock.mockResolvedValueOnce({
      id: 7,
      name: 'Hono',
      slug: 'hono',
      category: 'framework',
      iconKey: 'si:SiHono',
      isHighlighted: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    updateTagMock.mockResolvedValueOnce({
      id: 7,
      name: 'Hono Runtime',
      slug: 'hono-runtime',
      category: 'framework',
      iconKey: 'si:SiHono',
      isHighlighted: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    tagNameExistsMock.mockResolvedValueOnce(false);
    tagSlugExistsMock.mockResolvedValueOnce(false);

    const updated = await updateTagService(7, { name: 'Hono Runtime' });

    expect(created).not.toHaveProperty('isHighlighted');
    expect(updated).not.toHaveProperty('isHighlighted');
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
    findTagByIdMock.mockResolvedValue({
      id: 10,
      name: 'Docker',
      slug: 'docker',
      category: 'infra',
    });
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
