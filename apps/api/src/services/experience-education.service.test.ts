/**
 * Service tests for experience and education domains.
 *
 * Covers: slug collision handling, date consistency validation,
 * cache invalidation, soft-delete behaviour.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks (must be before any dynamic import) ─────────────────────────

const {
  dbSelectExperienceMock,
  invalidatePatternMock,
  findManyExperienceMock,
  findExperienceByIdMock,
  findExperienceBySlugMock,
  createExperienceMock,
  updateExperienceMock,
  softDeleteExperienceMock,
  findManyEducationMock,
  findEducationByIdMock,
  findEducationBySlugMock,
  createEducationMock,
  updateEducationMock,
  softDeleteEducationMock,
  ensureUniqueSlugMock,
  syncExperienceTagsMock,
  syncExperienceTagsInTxMock,
  assertTagsExistMock,
} = vi.hoisted(() => ({
  dbSelectExperienceMock: vi.fn(),
  invalidatePatternMock: vi.fn(),
  findManyExperienceMock: vi.fn(),
  findExperienceByIdMock: vi.fn(),
  findExperienceBySlugMock: vi.fn(),
  createExperienceMock: vi.fn(),
  updateExperienceMock: vi.fn(),
  softDeleteExperienceMock: vi.fn(),
  findManyEducationMock: vi.fn(),
  findEducationByIdMock: vi.fn(),
  findEducationBySlugMock: vi.fn(),
  createEducationMock: vi.fn(),
  updateEducationMock: vi.fn(),
  softDeleteEducationMock: vi.fn(),
  ensureUniqueSlugMock: vi.fn(),
  syncExperienceTagsMock: vi.fn(),
  syncExperienceTagsInTxMock: vi.fn(),
  assertTagsExistMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: dbSelectExperienceMock,
        })),
      })),
    })),
    // Passes an empty-ish tx; all DB operations inside the transaction are
    // intercepted by the repo mocks, so tx methods are never called directly.
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  },
}));

vi.mock('../lib/cache', () => ({
  cached: vi.fn((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidatePattern: invalidatePatternMock,
  invalidateGroup: vi.fn(async (group: string) => {
    if (group === 'experienceContent') {
      await invalidatePatternMock('experience:*');
    }
    if (group === 'educationContent') {
      await invalidatePatternMock('education:*');
    }
  }),
}));

vi.mock('../lib/slug', () => ({
  generateSlug: vi.fn((text: string) =>
    text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  ),
  ensureUniqueSlug: ensureUniqueSlugMock,
}));

vi.mock('../repositories/experience.repo', () => ({
  findManyExperience: findManyExperienceMock,
  findExperienceById: findExperienceByIdMock,
  findExperienceBySlug: findExperienceBySlugMock,
  createExperience: createExperienceMock,
  updateExperience: updateExperienceMock,
  softDeleteExperience: softDeleteExperienceMock,
  // Inline real implementation so the service can call it without issues in tests
  flattenExperienceTags: (item: { tags?: Array<{ tag: unknown }> }) => ({
    ...item,
    tags: (item.tags ?? []).map((pivot) => pivot.tag),
  }),
}));

vi.mock('../repositories/tags.repo', () => ({
  syncExperienceTags: syncExperienceTagsMock,
  syncExperienceTagsInTx: syncExperienceTagsInTxMock,
  syncPostTags: vi.fn(),
  syncProjectTags: vi.fn(),
}));

vi.mock('../lib/tagValidation', () => ({
  assertTagsExist: assertTagsExistMock,
  normalizeTagIds: (tagIds: number[]) => Array.from(new Set(tagIds)),
}));

vi.mock('../repositories/education.repo', () => ({
  findManyEducation: findManyEducationMock,
  findEducationById: findEducationByIdMock,
  findEducationBySlug: findEducationBySlugMock,
  createEducation: createEducationMock,
  updateEducation: updateEducationMock,
  softDeleteEducation: softDeleteEducationMock,
}));

import {
  createEducationService,
  listEducation,
  softDeleteEducationService,
  updateEducationService,
} from './education.service';
import {
  createExperienceService,
  listExperience,
  softDeleteExperienceService,
  updateExperienceService,
} from './experience.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const baseExperience = {
  id: 1,
  slug: 'software-engineer-acme',
  role: 'Software Engineer',
  company: 'Acme Corp',
  description: 'Building things.',
  location: null,
  employmentType: 'Full-time',
  startDate: '2022-01-01',
  endDate: null,
  isCurrent: true,
  order: 0,
  status: 'published' as const,
  logoUrl: null,
  credentialUrl: null,
  deletedAt: null,
  createdAt: new Date('2022-01-01'),
  updatedAt: new Date('2022-01-01'),
  tags: [] as Array<{ tag: unknown }>,
  skills: [] as Array<{ skill: unknown }>,
};

const baseEducation = {
  id: 2,
  slug: 'computer-science-university',
  title: 'Computer Science',
  institution: 'University',
  description: null,
  location: null,
  educationType: 'Degree',
  startDate: '2018-01-01',
  endDate: '2022-12-31',
  isCurrent: false,
  workloadHours: null,
  credentialId: null,
  credentialUrl: null,
  order: 0,
  status: 'published' as const,
  logoUrl: null,
  deletedAt: null,
  createdAt: new Date('2022-01-01'),
  updatedAt: new Date('2022-01-01'),
};

// ── Experience service tests ──────────────────────────────────────────────────

describe('experience service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all submitted tagIds are valid.
    assertTagsExistMock.mockResolvedValue(undefined);
  });

  // List ──────────────────────────────────────────────────────────────────────

  describe('listExperience', () => {
    it('returns cached result in public mode', async () => {
      const mockResult = {
        data: [baseExperience],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManyExperienceMock.mockResolvedValueOnce(mockResult);

      const result = await listExperience({ page: 1, perPage: 20 }, false);

      expect(result).toEqual(mockResult);
      expect(findManyExperienceMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, false);
    });

    it('flattens pivot tags to Tag[] in the returned entries', async () => {
      const tag = {
        id: 5,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        iconKey: null,
        highlighted: false,
        order: 0,
        createdAt: new Date(),
      };
      const experienceWithTag = { ...baseExperience, tags: [{ tag }] };
      findManyExperienceMock.mockResolvedValueOnce({
        data: [experienceWithTag],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const result = await listExperience({ page: 1, perPage: 20 }, false);

      expect(result.data[0]?.tags).toEqual([tag]);
    });

    it('bypasses cache in admin mode', async () => {
      const mockResult = {
        data: [baseExperience],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManyExperienceMock.mockResolvedValueOnce(mockResult);

      await listExperience({ page: 1, perPage: 20 }, true);

      expect(findManyExperienceMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, true);
    });
  });

  // Create ────────────────────────────────────────────────────────────────────

  describe('createExperienceService', () => {
    it('generates slug from role + company', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('software-engineer-acme-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);

      await createExperienceService({
        role: 'Software Engineer',
        company: 'Acme Corp',
        description: 'Building things.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
      });

      expect(ensureUniqueSlugMock).toHaveBeenCalledWith(
        'software-engineer-acme-corp',
        expect.any(Function)
      );
    });

    it('uses provided slug instead of generating one', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('custom-slug');
      createExperienceMock.mockResolvedValueOnce(baseExperience);

      await createExperienceService({
        role: 'Engineer',
        company: 'Co',
        description: 'Desc.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
        slug: 'custom-slug',
      });

      expect(ensureUniqueSlugMock).toHaveBeenCalledWith('custom-slug', expect.any(Function));
    });

    it('throws VALIDATION_ERROR when endDate is before startDate', async () => {
      await expect(
        createExperienceService({
          role: 'Engineer',
          company: 'Co',
          description: 'Desc.',
          startDate: '2023-01-01',
          endDate: '2022-01-01',
          isCurrent: false,
          status: 'draft',
          order: 0,
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('throws VALIDATION_ERROR when isCurrent=false and endDate is missing', async () => {
      await expect(
        createExperienceService({
          role: 'Engineer',
          company: 'Co',
          description: 'Desc.',
          startDate: '2023-01-01',
          isCurrent: false,
          status: 'draft',
          order: 0,
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('invalidates experience cache after successful create', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);

      await createExperienceService({
        role: 'Engineer',
        company: 'Corp',
        description: 'D.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
      });

      expect(invalidatePatternMock).toHaveBeenCalledWith('experience:*');
    });

    it('throws when repository returns no row', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(null);

      await expect(
        createExperienceService({
          role: 'Engineer',
          company: 'Corp',
          description: 'D.',
          startDate: '2022-01-01',
          isCurrent: true,
          status: 'draft',
          order: 0,
        })
      ).rejects.toThrow('Failed to create experience');
    });

    it('normalizes impactFacts before persisting experience entries', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);

      await createExperienceService({
        role: 'Engineer',
        company: 'Corp',
        description: 'D.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
        impactFacts: ['  Reduziu tempo de deploy em 60%  '],
      });

      expect(createExperienceMock).toHaveBeenCalledWith(
        expect.objectContaining({ impactFacts: ['Reduziu tempo de deploy em 60%'] }),
        expect.anything()
      );
    });

    it('returns experience with flattened tags after create', async () => {
      const tag = {
        id: 3,
        name: 'Bun',
        slug: 'bun',
        category: 'tool',
        iconKey: null,
        highlighted: false,
        order: 0,
        createdAt: new Date(),
      };
      const experienceWithTag = { ...baseExperience, tags: [{ tag }] };

      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);
      findExperienceByIdMock.mockResolvedValueOnce(experienceWithTag); // post-create re-fetch
      syncExperienceTagsInTxMock.mockResolvedValueOnce(undefined);

      const result = await createExperienceService({
        role: 'Engineer',
        company: 'Corp',
        description: 'D.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
        tagIds: [3],
      });

      expect(result?.tags).toEqual([tag]);
    });

    it('rejects entirely when tag sync fails inside the transaction', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);
      syncExperienceTagsInTxMock.mockRejectedValueOnce(new Error('tag sync failed'));

      await expect(
        createExperienceService({
          role: 'Engineer',
          company: 'Corp',
          description: 'D.',
          startDate: '2022-01-01',
          isCurrent: true,
          status: 'draft',
          order: 0,
          tagIds: [1],
        })
      ).rejects.toThrow('tag sync failed');

      // Cache must NOT be invalidated when the transaction rolls back
      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });
  });

  // Update ─────────────────────────────────────────────────────────────────────

  describe('updateExperienceService', () => {
    it('returns null when entry does not exist', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(null);

      const result = await updateExperienceService(999, { role: 'New Role' });
      expect(result).toBeNull();
    });

    it('invalidates cache after successful update', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);
      updateExperienceMock.mockResolvedValueOnce({ ...baseExperience, role: 'New Role' });

      await updateExperienceService(1, { role: 'New Role' });

      expect(invalidatePatternMock).toHaveBeenCalledWith('experience:*');
    });

    it('throws VALIDATION_ERROR when merged dates are inconsistent', async () => {
      findExperienceByIdMock.mockResolvedValueOnce({
        ...baseExperience,
        startDate: '2023-06-01',
        endDate: null,
        isCurrent: false,
      });

      await expect(updateExperienceService(1, { endDate: '2022-01-01' })).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });

    it('throws VALIDATION_ERROR when merged state is non-current without endDate', async () => {
      findExperienceByIdMock.mockResolvedValueOnce({
        ...baseExperience,
        endDate: null,
        isCurrent: true,
      });

      await expect(updateExperienceService(1, { isCurrent: false })).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });

    it('rejects invalid impactFacts payloads before persisting experience updates', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);

      await expect(updateExperienceService(1, { impactFacts: ['   '] })).rejects.toMatchObject({
        message: expect.stringContaining('VALIDATION_ERROR'),
        validationDetails: [{ field: 'impactFacts', message: 'Impact fact cannot be empty' }],
      });

      expect(updateExperienceMock).not.toHaveBeenCalled();
    });
  });

  // Soft delete ────────────────────────────────────────────────────────────────

  describe('softDeleteExperienceService', () => {
    it('returns null when entry does not exist', async () => {
      softDeleteExperienceMock.mockResolvedValueOnce(null);

      const result = await softDeleteExperienceService(999);
      expect(result).toBeNull();
      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });

    it('invalidates cache after soft delete', async () => {
      softDeleteExperienceMock.mockResolvedValueOnce(baseExperience);

      await softDeleteExperienceService(1);

      expect(invalidatePatternMock).toHaveBeenCalledWith('experience:*');
    });
  });
  // Tag sync ────────────────────────────────────────────────────────────────────────────

  describe('tag synchronization', () => {
    it('syncs tagIds during create when tagIds are provided', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);
      syncExperienceTagsInTxMock.mockResolvedValueOnce(undefined);

      await createExperienceService({
        role: 'Engineer',
        company: 'Corp',
        description: 'D.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
        tagIds: [1, 2, 3],
      });

      expect(syncExperienceTagsInTxMock).toHaveBeenCalledWith({}, baseExperience.id, [1, 2, 3]);
    });

    it('does not sync tags during create when tagIds are not provided', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      createExperienceMock.mockResolvedValueOnce(baseExperience);

      await createExperienceService({
        role: 'Engineer',
        company: 'Corp',
        description: 'D.',
        startDate: '2022-01-01',
        isCurrent: true,
        status: 'draft',
        order: 0,
      });

      expect(syncExperienceTagsInTxMock).not.toHaveBeenCalled();
    });

    it('syncs tagIds during update when tagIds are provided', async () => {
      findExperienceByIdMock
        .mockResolvedValueOnce(baseExperience) // for initial load
        .mockResolvedValueOnce(baseExperience); // for post-update refresh
      updateExperienceMock.mockResolvedValueOnce({ ...baseExperience, role: 'New Role' });
      syncExperienceTagsInTxMock.mockResolvedValueOnce(undefined);

      await updateExperienceService(1, { role: 'New Role', tagIds: [5, 6] });

      expect(syncExperienceTagsInTxMock).toHaveBeenCalledWith({}, 1, [5, 6]);
    });

    it('does not sync tags during update when tagIds is absent', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);
      updateExperienceMock.mockResolvedValueOnce({ ...baseExperience, role: 'New Role' });

      await updateExperienceService(1, { role: 'New Role' });

      expect(syncExperienceTagsInTxMock).not.toHaveBeenCalled();
    });

    it('syncs empty tagIds to clear all tags', async () => {
      findExperienceByIdMock
        .mockResolvedValueOnce(baseExperience)
        .mockResolvedValueOnce(baseExperience);
      updateExperienceMock.mockResolvedValueOnce(baseExperience);
      syncExperienceTagsInTxMock.mockResolvedValueOnce(undefined);

      await updateExperienceService(1, { tagIds: [] });

      expect(syncExperienceTagsInTxMock).toHaveBeenCalledWith({}, 1, []);
    });

    // Tag referential integrity ───────────────────────────────────────────────

    it('throws VALIDATION_ERROR when create is submitted with nonexistent tagIds', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('engineer-corp');
      assertTagsExistMock.mockRejectedValueOnce(
        Object.assign(new Error('VALIDATION_ERROR: One or more tagIds do not exist: 999'), {
          invalidTagIds: [999],
        })
      );

      await expect(
        createExperienceService({
          role: 'Engineer',
          company: 'Corp',
          description: 'D.',
          startDate: '2022-01-01',
          isCurrent: true,
          status: 'draft',
          order: 0,
          tagIds: [999],
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('VALIDATION_ERROR'),
        invalidTagIds: [999],
      });

      // Cache must NOT be invalidated when validation fails before the transaction
      expect(invalidatePatternMock).not.toHaveBeenCalled();
      expect(createExperienceMock).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when update is submitted with nonexistent tagIds', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);
      assertTagsExistMock.mockRejectedValueOnce(
        Object.assign(new Error('VALIDATION_ERROR: One or more tagIds do not exist: 7, 8'), {
          invalidTagIds: [7, 8],
        })
      );

      await expect(updateExperienceService(1, { tagIds: [7, 8] })).rejects.toMatchObject({
        message: expect.stringContaining('VALIDATION_ERROR'),
        invalidTagIds: [7, 8],
      });

      expect(invalidatePatternMock).not.toHaveBeenCalled();
      expect(updateExperienceMock).not.toHaveBeenCalled();
    });

    it('does not call assertTagsExist when tagIds is absent from update payload', async () => {
      findExperienceByIdMock.mockResolvedValueOnce(baseExperience);
      updateExperienceMock.mockResolvedValueOnce({ ...baseExperience, role: 'New Role' });

      await updateExperienceService(1, { role: 'New Role' });

      expect(assertTagsExistMock).not.toHaveBeenCalled();
    });
  });
});

// ── Education service tests ───────────────────────────────────────────────────

describe('education service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // List ──────────────────────────────────────────────────────────────────────

  describe('listEducation', () => {
    it('returns paginated data from repo in public mode', async () => {
      const mockResult = {
        data: [baseEducation],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      findManyEducationMock.mockResolvedValueOnce(mockResult);

      const result = await listEducation({ page: 1, perPage: 20 }, false);

      expect(result).toEqual(mockResult);
      expect(findManyEducationMock).toHaveBeenCalledWith({ page: 1, perPage: 20 }, false);
    });

    it('bypasses cache in admin mode', async () => {
      findManyEducationMock.mockResolvedValueOnce({ data: [], meta: {} });

      await listEducation({ page: 1 }, true);

      expect(findManyEducationMock).toHaveBeenCalledWith({ page: 1 }, true);
    });
  });

  // Create ─────────────────────────────────────────────────────────────────────

  describe('createEducationService', () => {
    it('generates slug from title + institution', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('computer-science-university');
      createEducationMock.mockResolvedValueOnce(baseEducation);

      await createEducationService({
        title: 'Computer Science',
        institution: 'University',
        isCurrent: false,
        status: 'draft',
        order: 0,
      });

      expect(ensureUniqueSlugMock).toHaveBeenCalledWith(
        'computer-science-university',
        expect.any(Function)
      );
    });

    it('throws VALIDATION_ERROR when endDate is before startDate', async () => {
      await expect(
        createEducationService({
          title: 'CS',
          institution: 'Uni',
          startDate: '2023-01-01',
          endDate: '2022-01-01',
          isCurrent: false,
          status: 'draft',
          order: 0,
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('invalidates education cache after create', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('cs-uni');
      createEducationMock.mockResolvedValueOnce(baseEducation);

      await createEducationService({
        title: 'CS',
        institution: 'Uni',
        isCurrent: false,
        status: 'draft',
        order: 0,
      });

      expect(invalidatePatternMock).toHaveBeenCalledWith('education:*');
    });

    it('throws when repository returns no row', async () => {
      ensureUniqueSlugMock.mockResolvedValueOnce('cs-uni');
      createEducationMock.mockResolvedValueOnce(null);

      await expect(
        createEducationService({
          title: 'CS',
          institution: 'Uni',
          isCurrent: false,
          status: 'draft',
          order: 0,
        })
      ).rejects.toThrow('Failed to create education');
    });
  });

  // Update ─────────────────────────────────────────────────────────────────────

  describe('updateEducationService', () => {
    it('returns null when entry does not exist', async () => {
      findEducationByIdMock.mockResolvedValueOnce(null);

      const result = await updateEducationService(999, { title: 'New title' });
      expect(result).toBeNull();
    });

    it('invalidates cache after successful update', async () => {
      findEducationByIdMock.mockResolvedValueOnce(baseEducation);
      updateEducationMock.mockResolvedValueOnce({ ...baseEducation, title: 'New title' });

      await updateEducationService(2, { title: 'New title' });

      expect(invalidatePatternMock).toHaveBeenCalledWith('education:*');
    });

    it('throws VALIDATION_ERROR when merged dates are inconsistent', async () => {
      findEducationByIdMock.mockResolvedValueOnce({
        ...baseEducation,
        startDate: '2023-01-01',
        endDate: '2023-12-31',
      });

      await expect(updateEducationService(2, { endDate: '2022-01-01' })).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });
  });

  // Soft delete ────────────────────────────────────────────────────────────────

  describe('softDeleteEducationService', () => {
    it('returns null when entry does not exist', async () => {
      softDeleteEducationMock.mockResolvedValueOnce(null);

      const result = await softDeleteEducationService(999);
      expect(result).toBeNull();
      expect(invalidatePatternMock).not.toHaveBeenCalled();
    });

    it('invalidates cache after soft delete', async () => {
      softDeleteEducationMock.mockResolvedValueOnce(baseEducation);

      await softDeleteEducationService(2);

      expect(invalidatePatternMock).toHaveBeenCalledWith('education:*');
    });
  });
});
