import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, HighlightLimitError } from '../lib/errors';

const {
  cachedMock,
  invalidateGroupMock,
  findManySkillsMock,
  findSkillByIdMock,
  findSkillByNameMock,
  skillNameExistsMock,
  skillSlugExistsMock,
  countHighlightedSkillsByCategoryMock,
  createSkillMock,
  updateSkillMock,
  deleteSkillMock,
  resolveTagIconMock,
  generateSlugMock,
  ensureUniqueSlugMock,
} = vi.hoisted(() => ({
  cachedMock: vi.fn(),
  invalidateGroupMock: vi.fn(),
  findManySkillsMock: vi.fn(),
  findSkillByIdMock: vi.fn(),
  findSkillByNameMock: vi.fn(),
  skillNameExistsMock: vi.fn(),
  skillSlugExistsMock: vi.fn(),
  countHighlightedSkillsByCategoryMock: vi.fn(),
  createSkillMock: vi.fn(),
  updateSkillMock: vi.fn(),
  deleteSkillMock: vi.fn(),
  resolveTagIconMock: vi.fn(),
  generateSlugMock: vi.fn(),
  ensureUniqueSlugMock: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  cached: cachedMock,
  invalidateGroup: invalidateGroupMock,
}));

vi.mock('../repositories/skills.repo', () => ({
  findManySkills: findManySkillsMock,
  findSkillById: findSkillByIdMock,
  findSkillByName: findSkillByNameMock,
  findExistingSkillIds: vi.fn(),
  skillNameExists: skillNameExistsMock,
  skillSlugExists: skillSlugExistsMock,
  countHighlightedSkillsByCategory: countHighlightedSkillsByCategoryMock,
  createSkill: createSkillMock,
  updateSkill: updateSkillMock,
  deleteSkill: deleteSkillMock,
  syncProjectSkillsInTx: vi.fn(),
  syncExperienceSkillsInTx: vi.fn(),
}));

vi.mock('@portfolio/shared/lib/iconResolver', () => ({
  resolveTagIcon: resolveTagIconMock,
}));

vi.mock('../lib/slug', () => ({
  generateSlug: generateSlugMock,
  ensureUniqueSlug: ensureUniqueSlugMock,
}));

import {
  createSkillService,
  deleteSkillService,
  getSkillById,
  listSkills,
  updateSkillService,
} from './skills.service';

const baseRow = {
  id: 1,
  name: 'TypeScript',
  slug: 'typescript',
  category: 'language',
  iconKey: 'si:SiTypescript',
  expertiseLevel: 3,
  isHighlighted: 1,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

describe('skills service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation((_key: string, _ttl: number, fetcher: () => unknown) =>
      fetcher()
    );
    invalidateGroupMock.mockResolvedValue(undefined);
    resolveTagIconMock.mockReturnValue({ iconKey: 'si:SiTypescript' });
    generateSlugMock.mockReturnValue('typescript');
    ensureUniqueSlugMock.mockResolvedValue('typescript');
  });

  // â”€â”€ listSkills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('listSkills', () => {
    it('returns mapped DTOs without cache by default', async () => {
      const mockResult = {
        data: [baseRow],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManySkillsMock.mockResolvedValueOnce(mockResult);

      const result = await listSkills({});

      expect(findManySkillsMock).toHaveBeenCalledTimes(1);
      expect(cachedMock).not.toHaveBeenCalled();
      expect(result.data[0]).toMatchObject({
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        expertiseLevel: 3,
        isHighlighted: true,
      });
    });

    it('uses cached() when useCache=true', async () => {
      const mockResult = {
        data: [baseRow],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManySkillsMock.mockResolvedValueOnce(mockResult);

      await listSkills({ category: 'language', page: 2, perPage: 10 }, true);

      expect(cachedMock).toHaveBeenCalledTimes(1);
      const [cacheKey] = cachedMock.mock.calls[0] as [string, number, unknown];
      expect(cacheKey).toContain('skills:public:');
      expect(cacheKey).toContain('page=2');
      expect(cacheKey).toContain('perPage=10');
      expect(cacheKey).toContain('language');
    });

    it('uses distinct public cache keys for different pagination windows', async () => {
      const mockResult = {
        data: [baseRow],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManySkillsMock.mockResolvedValue(mockResult);

      await listSkills({ page: 1, perPage: 10 }, true);
      await listSkills({ page: 2, perPage: 10 }, true);

      const firstKey = cachedMock.mock.calls[0]?.[0] as string;
      const secondKey = cachedMock.mock.calls[1]?.[0] as string;

      expect(firstKey).not.toBe(secondKey);
      expect(firstKey).toContain('page=1');
      expect(secondKey).toContain('page=2');
    });
  });

  // â”€â”€ createSkillService â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('createSkillService', () => {
    it('creates and returns DTO when name is unique', async () => {
      findSkillByNameMock.mockResolvedValueOnce(null);
      countHighlightedSkillsByCategoryMock.mockResolvedValueOnce(0);
      createSkillMock.mockResolvedValueOnce(baseRow);

      const result = await createSkillService({
        name: 'TypeScript',
        category: 'language',
        expertiseLevel: 3,
        isHighlighted: true,
      });

      expect(createSkillMock).toHaveBeenCalledTimes(1);
      expect(invalidateGroupMock).toHaveBeenCalledWith('skillsContent');
      expect(result.isHighlighted).toBe(true);
    });

    it('throws CONFLICT when name is already taken', async () => {
      findSkillByNameMock.mockResolvedValueOnce(baseRow);

      await expect(
        createSkillService({ name: 'TypeScript', category: 'language' })
      ).rejects.toThrow(ConflictError);
    });

    it('throws HIGHLIGHT_LIMIT when category already has 2 highlighted skills', async () => {
      findSkillByNameMock.mockResolvedValueOnce(null);
      countHighlightedSkillsByCategoryMock.mockResolvedValueOnce(2);

      await expect(
        createSkillService({ name: 'NewLang', category: 'language', isHighlighted: true })
      ).rejects.toThrow(HighlightLimitError);
    });

    it('does not check highlight limit when isHighlighted is false', async () => {
      findSkillByNameMock.mockResolvedValueOnce(null);
      createSkillMock.mockResolvedValueOnce({ ...baseRow, isHighlighted: 0, expertiseLevel: 1 });

      await createSkillService({ name: 'SomeLang', category: 'language', isHighlighted: false });

      expect(countHighlightedSkillsByCategoryMock).not.toHaveBeenCalled();
    });
  });

  // â”€â”€ updateSkillService â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('updateSkillService', () => {
    it('returns null when skill does not exist', async () => {
      findSkillByIdMock.mockResolvedValueOnce(null);

      const result = await updateSkillService(99, { name: 'Ghost' });

      expect(result).toBeNull();
    });

    it('returns original DTO without writing when patch is empty', async () => {
      findSkillByIdMock.mockResolvedValueOnce(baseRow);

      const result = await updateSkillService(1, {});

      expect(updateSkillMock).not.toHaveBeenCalled();
      expect(result?.name).toBe('TypeScript');
    });

    it('throws CONFLICT when new name is already taken by another skill', async () => {
      findSkillByIdMock.mockResolvedValueOnce(baseRow);
      skillNameExistsMock.mockResolvedValueOnce(true);

      await expect(updateSkillService(1, { name: 'DuplicateName' })).rejects.toThrow(ConflictError);
    });

    it('throws HIGHLIGHT_LIMIT when setting isHighlighted=true exceeds cap', async () => {
      findSkillByIdMock.mockResolvedValueOnce({ ...baseRow, isHighlighted: 0 });
      countHighlightedSkillsByCategoryMock.mockResolvedValueOnce(2);

      await expect(updateSkillService(1, { isHighlighted: true })).rejects.toThrow(
        HighlightLimitError
      );
    });

    it('updates name, regenerates slug, and invalidates cache', async () => {
      findSkillByIdMock.mockResolvedValueOnce(baseRow);
      skillNameExistsMock.mockResolvedValueOnce(false);
      generateSlugMock.mockReturnValueOnce('typescript-v2');
      ensureUniqueSlugMock.mockResolvedValueOnce('typescript-v2');
      updateSkillMock.mockResolvedValueOnce({
        ...baseRow,
        name: 'TypeScript v2',
        slug: 'typescript-v2',
      });

      const result = await updateSkillService(1, { name: 'TypeScript v2' });

      expect(updateSkillMock).toHaveBeenCalledTimes(1);
      expect(invalidateGroupMock).toHaveBeenCalledWith('skillsContent');
      expect(result?.name).toBe('TypeScript v2');
    });
  });

  // â”€â”€ deleteSkillService â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('deleteSkillService', () => {
    it('returns null when skill does not exist', async () => {
      findSkillByIdMock.mockResolvedValueOnce(null);

      const result = await deleteSkillService(99);

      expect(result).toBeNull();
      expect(deleteSkillMock).not.toHaveBeenCalled();
    });

    it('deletes skill and invalidates cache', async () => {
      findSkillByIdMock.mockResolvedValueOnce(baseRow);
      deleteSkillMock.mockResolvedValueOnce({ id: 1 });

      const result = await deleteSkillService(1);

      expect(deleteSkillMock).toHaveBeenCalledWith(1);
      expect(invalidateGroupMock).toHaveBeenCalledWith('skillsContent');
      expect(result).toEqual({ id: 1 });
    });
  });

  // â”€â”€ getSkillById â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('getSkillById', () => {
    it('returns mapped DTO when found', async () => {
      findSkillByIdMock.mockResolvedValueOnce(baseRow);

      const result = await getSkillById(1);

      expect(result?.id).toBe(1);
      expect(result?.isHighlighted).toBe(true);
    });

    it('returns null when not found', async () => {
      findSkillByIdMock.mockResolvedValueOnce(null);

      const result = await getSkillById(99);

      expect(result).toBeNull();
    });
  });
});
