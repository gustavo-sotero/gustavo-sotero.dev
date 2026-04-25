import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cachedMock,
  invalidatePatternMock,
  findManyTagsMock,
  findTagByIdMock,
  findTagByNameMock,
  findTagBySlugMock,
  tagNameExistsMock,
  tagSlugExistsMock,
  createTagMock,
  updateTagMock,
  deleteTagMock,
  syncPostTagsMock,
  findAllTagsForNormalizationMock,
  findTagsBySlugsM,
} = vi.hoisted(() => ({
  cachedMock: vi.fn(),
  invalidatePatternMock: vi.fn(),
  findManyTagsMock: vi.fn(),
  findTagByIdMock: vi.fn(),
  findTagByNameMock: vi.fn(),
  findTagBySlugMock: vi.fn(),
  tagNameExistsMock: vi.fn(),
  tagSlugExistsMock: vi.fn(),
  createTagMock: vi.fn(),
  updateTagMock: vi.fn(),
  deleteTagMock: vi.fn(),
  syncPostTagsMock: vi.fn(),
  findAllTagsForNormalizationMock: vi.fn(),
  findTagsBySlugsM: vi.fn(),
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
  }),
}));

vi.mock('../repositories/tags.repo', () => ({
  findManyTags: findManyTagsMock,
  findTagById: findTagByIdMock,
  findTagByName: findTagByNameMock,
  findTagBySlug: findTagBySlugMock,
  tagNameExists: tagNameExistsMock,
  tagSlugExists: tagSlugExistsMock,
  createTag: createTagMock,
  updateTag: updateTagMock,
  deleteTag: deleteTagMock,
  syncPostTags: syncPostTagsMock,
  findAllTagsForNormalization: findAllTagsForNormalizationMock,
  findTagsBySlugs: findTagsBySlugsM,
}));

import {
  createTagService,
  deleteTagService,
  listTags,
  resolveAiSuggestedTags,
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
    findTagBySlugMock.mockResolvedValue(null);
    findAllTagsForNormalizationMock.mockResolvedValue([]);
    findTagsBySlugsM.mockResolvedValue([]);
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

    const result = await listTags({ category: 'language,framework', source: 'post' }, true);

    expect(cachedMock).toHaveBeenCalledWith(
      'tags:public:category=language,framework:source=post',
      300,
      expect.any(Function)
    );
    expect(findManyTagsMock).toHaveBeenCalledWith(
      { category: 'language,framework', source: 'post' },
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

    await syncTags(5, [1, 2]);

    expect(syncPostTagsMock).toHaveBeenCalledWith(5, [1, 2]);
    expect(invalidatePatternMock).toHaveBeenCalledWith('posts:*');
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

  // ── resolveAiSuggestedTags ───────────────────────────────────────────────────

  describe('resolveAiSuggestedTags', () => {
    const redisRow = {
      id: 5,
      name: 'Redis',
      slug: 'redis',
      category: 'db',
      iconKey: 'si:SiRedis',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('reuses an existing tag when the slug already exists in the database', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([redisRow]);

      const result = await resolveAiSuggestedTags(['Redis']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 5, name: 'Redis', slug: 'redis' });
      expect(createTagMock).not.toHaveBeenCalled();
    });

    it('creates a missing tag with category inferred from the shared catalog', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([]);
      findTagByNameMock.mockResolvedValue(null);
      tagSlugExistsMock.mockResolvedValue(false);
      createTagMock.mockResolvedValueOnce({
        id: 10,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: 'si:SiRedis',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await resolveAiSuggestedTags(['Redis']);

      // createTagService internally calls createTagMock with category='db' from catalog
      expect(createTagMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Redis', category: 'db' })
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 10, name: 'Redis', category: 'db' });
    });

    it('infers "other" category when the name is not in the catalog', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([]);
      findTagByNameMock.mockResolvedValue(null);
      tagSlugExistsMock.mockResolvedValue(false);
      createTagMock.mockResolvedValueOnce({
        id: 20,
        name: 'UnknownFramework2099',
        slug: 'unknownframework2099',
        category: 'other',
        iconKey: 'lucide:Tag',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await resolveAiSuggestedTags(['UnknownFramework2099']);

      expect(createTagMock).toHaveBeenCalledWith(expect.objectContaining({ category: 'other' }));
      expect(result[0]).toMatchObject({ category: 'other' });
    });

    it('deduplicates by slug — multiple AI name variants resolve to one tag', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([redisRow]);

      // 'redis' and 'Redis' both canonicalize to 'Redis' (slug 'redis')
      const result = await resolveAiSuggestedTags(['redis', 'Redis']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 5 });
    });

    it('returns empty array for an empty input list', async () => {
      const result = await resolveAiSuggestedTags([]);
      expect(result).toEqual([]);
      expect(findTagsBySlugsM).not.toHaveBeenCalled();
    });

    it('recovers from a concurrent creation race by fetching the existing row', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([]);
      findTagByNameMock.mockResolvedValueOnce(null); // conflict check inside createTagService
      tagSlugExistsMock.mockResolvedValue(false);
      // Simulate another worker created the tag first → createTag throws unique constraint
      createTagMock.mockRejectedValueOnce(new Error('CONFLICT: Tag name "Redis" is already taken'));
      // Recovery fetch
      findTagByNameMock.mockResolvedValueOnce(redisRow);

      const result = await resolveAiSuggestedTags(['Redis']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 5, name: 'Redis' });
    });

    it('recovers from a raw slug unique violation by refetching the winner by slug', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([]);
      findTagByNameMock.mockResolvedValueOnce(null); // conflict check inside createTagService
      tagSlugExistsMock.mockResolvedValue(false);
      createTagMock.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "tags_slug_unique"')
      );
      findTagByNameMock.mockResolvedValueOnce(null); // recovery by name misses
      findTagBySlugMock.mockResolvedValueOnce(redisRow); // recovery by slug wins

      const result = await resolveAiSuggestedTags(['Redis']);

      expect(findTagBySlugMock).toHaveBeenCalledWith('redis');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 5, name: 'Redis', slug: 'redis' });
    });

    it('invalidates the tags cache when at least one tag is created', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([]);
      findTagByNameMock.mockResolvedValue(null);
      tagSlugExistsMock.mockResolvedValue(false);
      createTagMock.mockResolvedValueOnce({
        id: 11,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: 'si:SiRedis',
        createdAt: new Date(),
      });

      await resolveAiSuggestedTags(['Redis']);

      // createTagService calls invalidatePattern('tags:*')
      expect(invalidatePatternMock).toHaveBeenCalledWith('tags:*');
    });

    it('does not call createTag when all suggested names map to existing tags', async () => {
      findTagsBySlugsM.mockResolvedValueOnce([redisRow]);

      await resolveAiSuggestedTags(['Redis']);

      expect(createTagMock).not.toHaveBeenCalled();
      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });
  });
});
