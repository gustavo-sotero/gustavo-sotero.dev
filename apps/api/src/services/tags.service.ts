/**
 * Service layer for tags.
 *
 * Handles tag CRUD with slug generation/uniqueness, cascade-aware deletion,
 * and cache invalidation. The pivot sync (`syncTags`) is delegated to the
 * repository which wraps pivot operations in a DB transaction.
 */

import {
  canonicalizeSuggestedTagNames,
  inferTagCategoryFromCatalog,
} from '@portfolio/shared/lib/aiTagNormalizer';
import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import type { CreateTagSchemaInput, UpdateTagSchemaInput } from '@portfolio/shared/schemas/tags';
import type { Tag } from '@portfolio/shared/types/tags';
import { cached, invalidateGroup, invalidatePattern } from '../lib/cache';
import { ConflictError } from '../lib/errors';
import type { TotalCountQueryOptions } from '../lib/pagination';
import { toTagDto } from '../lib/pivotHelpers';
import { isUniqueViolationError } from '../lib/postgresErrors';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import {
  createTag,
  deleteTag,
  findAllTagsForNormalization,
  findManyTags,
  findTagById,
  findTagByName,
  findTagBySlug,
  findTagsBySlugs,
  syncPostTags,
  tagNameExists,
  tagSlugExists,
  updateTag,
} from '../repositories/tags.repo';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes

function mapTagRow(row: Parameters<typeof toTagDto>[0]): Tag {
  return toTagDto(row) as Tag;
}

// ── Service methods ───────────────────────────────────────────────────────────

export interface TagListFilters {
  category?: string;
  page?: string | number;
  perPage?: string | number;
  /** Restrict public tags to a specific entity origin. Tags are associated with posts only. */
  source?: 'post';
}

/**
 * List all tags (admin) or only tags used by published content (public).
 */
export async function listTags(
  filters: TagListFilters = {},
  publicOnly = false,
  options: TotalCountQueryOptions = {}
) {
  if (publicOnly) {
    const key = `tags:public:category=${filters.category ?? ''}:source=${filters.source ?? ''}:includeTotal=${options.includeTotal === false ? '0' : '1'}`;
    return cached(key, LIST_TTL, async () => {
      const result = await findManyTags(filters, true, options);
      return { ...result, data: result.data.map(mapTagRow) };
    });
  }
  const result = await findManyTags(filters, false, options);
  return { ...result, data: result.data.map(mapTagRow) };
}

/**
 * Create a new tag.
 * Auto-generates a slug from the name and enforces uniqueness.
 */
export async function createTagService(data: CreateTagSchemaInput) {
  const nameTaken = await findTagByName(data.name);
  if (nameTaken) {
    throw new ConflictError(`Tag name "${data.name}" is already taken`);
  }

  const baseSlug = generateSlug(data.name);
  const slug = await ensureUniqueSlug(baseSlug, (s) => tagSlugExists(s));

  const effectiveCategory = data.category ?? 'other';
  const { iconKey } = resolveTagIcon(data.name, effectiveCategory);

  const tag = await createTag({
    name: data.name,
    slug,
    category: effectiveCategory,
    iconKey,
  });
  if (!tag) {
    throw new Error('Failed to create tag — database returned no row');
  }

  await invalidatePattern('tags:*');
  return mapTagRow(tag);
}

/**
 * Update an existing tag by ID.
 * If `name` changes, regenerates the slug (ensuring uniqueness, excluding self).
 * Allows updating `category` and `name`.
 * `iconKey` is always recalculated server-side from the final name+category — never accepted from the client.
 */
export async function updateTagService(id: number, data: UpdateTagSchemaInput) {
  const current = await findTagById(id);
  if (!current) return null;

  const patch: Parameters<typeof updateTag>[1] = {};

  if (data.name !== undefined && data.name !== current.name) {
    const nameTaken = await tagNameExists(data.name, id);
    if (nameTaken) {
      throw new ConflictError(`Tag name "${data.name}" is already taken`);
    }

    patch.name = data.name;
    const baseSlug = generateSlug(data.name);
    patch.slug = await ensureUniqueSlug(baseSlug, (s) => tagSlugExists(s, id));
  }

  if (data.category !== undefined) patch.category = data.category;

  // Compute final effective name and category (after applying patch).
  const finalName = patch.name ?? current.name;
  const finalCategory = (patch.category ?? current.category) as Parameters<
    typeof resolveTagIcon
  >[1];

  // Always recalculate iconKey based on final name + category.
  // Backend is the authority — no manual iconKey accepted from client.
  const { iconKey: resolvedIconKey } = resolveTagIcon(finalName, finalCategory);
  if (resolvedIconKey !== current.iconKey) patch.iconKey = resolvedIconKey;

  if (Object.keys(patch).length === 0) return mapTagRow(current); // nothing to update

  const updated = await updateTag(id, patch);

  // Invalidate tag cache and also any content that may reference this tag
  await invalidateGroup('tagsContent');

  return updated ? mapTagRow(updated) : null;
}

/**
 * Delete a tag by ID (hard delete).
 * The FK CASCADE on pivots ensures post_tags rows are cleaned up.
 */
export async function deleteTagService(id: number) {
  const current = await findTagById(id);
  if (!current) return null;

  const result = await deleteTag(id);
  if (!result) return null;

  await invalidateGroup('tagsContent');

  return result;
}

/**
 * Resolve a list of AI-suggested tag names to persisted Tag records.
 *
 * For each canonicalized, deduplicated name:
 *  - If a tag with the derived slug already exists, the existing record is reused.
 *  - Otherwise, a new tag is created with the category inferred from the shared
 *    ICON_CATALOG (fallback: `'other'`).
 *
 * Concurrent creation races are handled: when `createTagService` throws a
 * CONFLICT error, the existing row is fetched by name and returned instead.
 *
 * @returns All resolved Tag objects (existing + newly created), deduplicated by ID.
 */
export async function resolveAiSuggestedTags(suggestedNames: string[]): Promise<Tag[]> {
  // 1. Canonicalize and deduplicate names via shared normalizer
  const allPersistedForNorm = await findAllTagsForNormalization();
  const canonicalized = canonicalizeSuggestedTagNames(suggestedNames, allPersistedForNorm);

  if (canonicalized.length === 0) return [];

  // 2. Batch-lookup existing tags by derived slug — minimises DB round trips
  const slugs = canonicalized.map((name) => generateSlug(name));
  const existingRows = await findTagsBySlugs(slugs);
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));

  // 3. Resolve each canonical name — reuse or create
  const resolvedTags: Tag[] = [];
  const seenIds = new Set<number>();

  for (const canonicalName of canonicalized) {
    const slug = generateSlug(canonicalName);
    const existing = existingBySlug.get(slug);

    if (existing) {
      if (!seenIds.has(existing.id)) {
        seenIds.add(existing.id);
        resolvedTags.push(mapTagRow(existing));
      }
      continue;
    }

    // Infer category from catalog and create
    const category = inferTagCategoryFromCatalog(canonicalName);
    try {
      const created = await createTagService({ name: canonicalName, category });
      if (!seenIds.has(created.id)) {
        seenIds.add(created.id);
        resolvedTags.push(created);
      }
    } catch (err) {
      // Race condition: another concurrent request created this tag first.
      // Recover from typed ConflictError or a native postgres unique violation.
      const isConflict = err instanceof ConflictError || isUniqueViolationError(err);

      if (isConflict) {
        const recovered = (await findTagByName(canonicalName)) ?? (await findTagBySlug(slug));
        if (recovered && !seenIds.has(recovered.id)) {
          seenIds.add(recovered.id);
          resolvedTags.push(mapTagRow(recovered));
          continue;
        }
      }

      throw err;
    }
  }

  return resolvedTags;
}

/**
 * Synchronize tags for a post.
 * Wraps the repository-level transactional sync.
 *
 * @param entityId - ID of the post
 * @param tagIds   - Complete list of desired tag IDs (replaces existing)
 */
export async function syncTags(entityId: number, tagIds: number[]): Promise<void> {
  await syncPostTags(entityId, tagIds);
  await invalidateGroup('postTagsSync');
}
