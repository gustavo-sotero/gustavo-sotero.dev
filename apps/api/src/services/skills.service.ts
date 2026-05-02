/**
 * Service layer for the Skill catalog.
 *
 * Handles: slug generation, uniqueness enforcement, highlight cap, icon
 * resolution, and cache invalidation. Architecture mirrors tags.service.ts.
 */

import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import type {
  CreateSkillSchemaInput,
  UpdateSkillSchemaInput,
} from '@portfolio/shared/schemas/skills';
import type { Skill } from '@portfolio/shared/types/skills';
import { cached, invalidateGroup } from '../lib/cache';
import { ConflictError, HighlightLimitError } from '../lib/errors';
import type {
  PaginatedListResult,
  TotalCountQueryOptions,
  WindowedListResult,
} from '../lib/pagination';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import type { SkillFilters } from '../repositories/skills.repo';
import {
  countHighlightedSkillsByCategory,
  createSkill,
  deleteSkill,
  findManySkills,
  findSkillById,
  findSkillByName,
  skillNameExists,
  skillSlugExists,
  updateSkill,
} from '../repositories/skills.repo';

const MAX_HIGHLIGHTED_PER_CATEGORY = 2;
const LIST_TTL = 300;

// ── Row → DTO mapper ──────────────────────────────────────────────────────────

function toSkillDto(row: {
  id: number;
  name: string;
  slug: string;
  category: string;
  iconKey: string | null;
  expertiseLevel: number;
  isHighlighted: number;
  createdAt: Date;
}): Skill {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category as Skill['category'],
    iconKey: row.iconKey,
    expertiseLevel: (row.expertiseLevel as 1 | 2 | 3) ?? 1,
    isHighlighted: row.isHighlighted === 1,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

// ── Public list ───────────────────────────────────────────────────────────────

export interface SkillListFilters {
  category?: string;
  highlighted?: boolean;
  page?: string | number;
  perPage?: string | number;
}

export function listSkills(
  filters: SkillListFilters,
  useCache: boolean,
  options: { includeTotal: false }
): Promise<WindowedListResult<Skill>>;
export function listSkills(
  filters?: SkillListFilters,
  useCache?: boolean,
  options?: TotalCountQueryOptions
): Promise<PaginatedListResult<Skill>>;

export async function listSkills(
  filters: SkillListFilters = {},
  useCache = false,
  options: TotalCountQueryOptions = {}
): Promise<PaginatedListResult<Skill> | WindowedListResult<Skill>> {
  if (useCache) {
    const key = `skills:public:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 100}:category=${filters.category ?? ''}:highlighted=${String(filters.highlighted ?? '')}:includeTotal=${options.includeTotal === false ? '0' : '1'}`;
    return cached(key, LIST_TTL, async () => {
      const result = await findManySkills(filters as SkillFilters, options);
      return { ...result, data: result.data.map(toSkillDto) };
    });
  }
  const result = await findManySkills(filters as SkillFilters, options);
  return { ...result, data: result.data.map(toSkillDto) };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createSkillService(data: CreateSkillSchemaInput): Promise<Skill> {
  const nameTaken = await findSkillByName(data.name);
  if (nameTaken) throw new ConflictError(`Skill name "${data.name}" is already taken`);

  const expertiseLevel = data.expertiseLevel ?? 1;
  const isHighlighted = data.isHighlighted ?? false;

  if (isHighlighted) {
    const highlightCount = await countHighlightedSkillsByCategory(data.category);
    if (highlightCount >= MAX_HIGHLIGHTED_PER_CATEGORY) {
      throw new HighlightLimitError(
        `Category "${data.category}" already has ${MAX_HIGHLIGHTED_PER_CATEGORY} highlighted skills. Remove one before adding another.`
      );
    }
  }

  const baseSlug = generateSlug(data.name);
  const slug = await ensureUniqueSlug(baseSlug, (s) => skillSlugExists(s));
  const { iconKey } = resolveTagIcon(data.name, data.category);

  const row = await createSkill({
    name: data.name,
    slug,
    category: data.category,
    iconKey,
    expertiseLevel,
    isHighlighted: isHighlighted ? 1 : 0,
  });

  if (!row) throw new Error('Failed to create skill — database returned no row');

  await invalidateGroup('skillsContent');
  return toSkillDto(row);
}

export async function updateSkillService(
  id: number,
  data: UpdateSkillSchemaInput
): Promise<Skill | null> {
  const current = await findSkillById(id);
  if (!current) return null;

  const patch: Parameters<typeof updateSkill>[1] = {};

  if (data.name !== undefined && data.name !== current.name) {
    const nameTaken = await skillNameExists(data.name, id);
    if (nameTaken) throw new ConflictError(`Skill name "${data.name}" is already taken`);
    patch.name = data.name;
    const baseSlug = generateSlug(data.name);
    patch.slug = await ensureUniqueSlug(baseSlug, (s) => skillSlugExists(s, id));
  }

  if (data.category !== undefined) patch.category = data.category;
  if (data.expertiseLevel !== undefined) patch.expertiseLevel = data.expertiseLevel;
  if (data.isHighlighted !== undefined) patch.isHighlighted = data.isHighlighted ? 1 : 0;

  const finalName = patch.name ?? current.name;
  const finalCategory = (patch.category ?? current.category) as Parameters<
    typeof resolveTagIcon
  >[1];
  const { iconKey: resolvedIconKey } = resolveTagIcon(finalName, finalCategory);
  if (resolvedIconKey !== current.iconKey) patch.iconKey = resolvedIconKey;

  const finalHighlighted =
    patch.isHighlighted !== undefined ? patch.isHighlighted === 1 : current.isHighlighted === 1;

  if (finalHighlighted) {
    const highlightCount = await countHighlightedSkillsByCategory(finalCategory, id);
    if (highlightCount >= MAX_HIGHLIGHTED_PER_CATEGORY) {
      throw new HighlightLimitError(
        `Category "${finalCategory}" already has ${MAX_HIGHLIGHTED_PER_CATEGORY} highlighted skills. Remove one before adding another.`
      );
    }
  }

  if (Object.keys(patch).length === 0) return toSkillDto(current);

  const updated = await updateSkill(id, patch);
  if (!updated) return null;

  await invalidateGroup('skillsContent');
  return toSkillDto(updated);
}

export async function deleteSkillService(id: number): Promise<{ id: number } | null> {
  const current = await findSkillById(id);
  if (!current) return null;
  const result = await deleteSkill(id);
  if (!result) return null;
  await invalidateGroup('skillsContent');
  return result;
}

export async function getSkillById(id: number): Promise<Skill | null> {
  const row = await findSkillById(id);
  return row ? toSkillDto(row) : null;
}
