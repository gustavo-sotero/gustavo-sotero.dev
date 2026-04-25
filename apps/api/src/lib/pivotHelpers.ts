/**
 * Shared helpers for common patterns across service/repository layers.
 *
 * flattenPivotTags — normalizes Drizzle many-to-many pivot objects to direct Tag arrays.
 * resolveSlugTaken — pure logic for determining if a slug is occupied, extracted from
 *                    the repetitive per-entity slug-check functions.
 */

/**
 * Remove legacy tag highlight metadata from API payloads.
 *
 * Tags remain content taxonomy; `isHighlighted` now belongs exclusively to the
 * skill catalog even if the database row still carries the historical column.
 */
export function toTagDto<
  TTag extends {
    id: number;
    name: string;
    slug: string;
    category: string;
    iconKey: string | null;
    createdAt?: Date | string;
    isHighlighted?: boolean;
  },
>(tag: TTag) {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    category: tag.category,
    iconKey: tag.iconKey,
    createdAt:
      tag.createdAt instanceof Date ? tag.createdAt.toISOString() : (tag.createdAt ?? null),
  };
}

/**
 * Normalize embedded skill rows to the public Skill DTO shape.
 *
 * Project/experience relation queries return raw DB rows, where booleans may
 * still be encoded as `0 | 1` and timestamps are `Date` objects.
 */
export function toSkillDto<
  TSkill extends {
    id: number;
    name: string;
    slug: string;
    category: string;
    iconKey: string | null;
    expertiseLevel: number;
    isHighlighted: number | boolean;
    createdAt: Date | string;
  },
>(skill: TSkill) {
  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    category: skill.category,
    iconKey: skill.iconKey,
    expertiseLevel: skill.expertiseLevel as 1 | 2 | 3,
    isHighlighted: skill.isHighlighted === true || skill.isHighlighted === 1,
    createdAt: skill.createdAt instanceof Date ? skill.createdAt.toISOString() : skill.createdAt,
  };
}

/**
 * Flatten a pivot array `{ tag: T }[]` to `T[]`.
 */
export function flattenPivotTagArray<TTag>(pivots?: Array<{ tag: TTag }>): TTag[] {
  return (pivots ?? []).map((pivot) => pivot.tag);
}

/**
 * Flatten Drizzle pivot objects `{ tag: T }` to a direct `T[]`.
 *
 * Drizzle returns pivot rows for many-to-many relations as `{ postId, tagId, tag: Tag }`.
 * This helper extracts the nested `tag` from each pivot so the JSON response
 * conforms to the shared type that expects a flat `tags: Tag[]`.
 *
 * @example
 *   const post = await findPostBySlug(slug);
 *   return flattenPivotTags(post); // { ...post, tags: Tag[] }
 */
export function flattenPivotTags<T extends { tags?: Array<{ tag: unknown }> }>(item: T) {
  return {
    ...item,
    tags: flattenPivotTagArray(item.tags).map((tag) =>
      toTagDto(tag as Parameters<typeof toTagDto>[0])
    ),
  };
}

/**
 * Flatten a pivot array `{ skill: T }[]` to `T[]`.
 */
export function flattenPivotSkillArray<TSkill>(pivots?: Array<{ skill: TSkill }>): TSkill[] {
  return (pivots ?? []).map((pivot) => pivot.skill);
}

/**
 * Flatten Drizzle pivot objects `{ skill: T }` to public Skill DTOs.
 */
export function flattenPivotSkills<
  T extends {
    tags?: unknown;
    skills?: Array<{
      skill: {
        id: number;
        name: string;
        slug: string;
        category: string;
        iconKey: string | null;
        expertiseLevel: number;
        isHighlighted: number | boolean;
        createdAt: Date | string;
      };
    }>;
  },
>(item: T) {
  const { tags: _legacyTags, ...rest } = item as T & { tags?: unknown };

  return {
    ...rest,
    skills: flattenPivotSkillArray(item.skills).map((skill) => toSkillDto(skill)),
  };
}

/**
 * Flatten both tag and skill pivots from a Drizzle entity.
 */
export function flattenPivots<
  T extends {
    tags?: Array<{ tag: unknown }>;
    skills?: Array<{
      skill: {
        id: number;
        name: string;
        slug: string;
        category: string;
        iconKey: string | null;
        expertiseLevel: number;
        isHighlighted: number | boolean;
        createdAt: Date | string;
      };
    }>;
  },
>(item: T) {
  return {
    ...item,
    tags: flattenPivotTagArray(item.tags).map((tag) =>
      toTagDto(tag as Parameters<typeof toTagDto>[0])
    ),
    skills: flattenPivotSkillArray(item.skills).map((skill) => toSkillDto(skill)),
  };
}

/**
 * Pure logic for "is this slug already taken" after performing the query.
 *
 * Each entity service executes its own table-specific query and delegates the
 * decision to this helper to avoid duplicating the same branching logic.
 *
 * @param rows      - Result of `db.select({ id: ... }).from(...).where(eq(slug, ...).limit(1)`
 * @param excludeId - When updating an entity, exclude its own ID from the check.
 * @returns `true` when the slug is occupied by another record.
 *
 * @example
 *   const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
 *   return resolveSlugTaken(rows, excludeId);
 */
export function resolveSlugTaken(rows: Array<{ id: number }>, excludeId?: number): boolean {
  if (rows.length === 0) return false;
  const found = rows.at(0);
  if (found === undefined) return false;
  if (excludeId !== undefined) return found.id !== excludeId;
  return true;
}
