/**
 * Service layer for tags.
 *
 * Handles tag CRUD with slug generation/uniqueness, cascade-aware deletion,
 * and cache invalidation. The pivot sync (`syncTags`) is delegated to the
 * repository which wraps pivot operations in a DB transaction.
 */

import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import type { CreateTagSchemaInput, UpdateTagSchemaInput } from '@portfolio/shared/schemas/tags';
import type { Tag } from '@portfolio/shared/types/tags';
import { cached, invalidateGroup, invalidatePattern } from '../lib/cache';
import { toTagDto } from '../lib/pivotHelpers';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import {
  createTag,
  deleteTag,
  findManyTags,
  findTagById,
  findTagByName,
  syncPostTags,
  syncProjectTags,
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
  /** Restrict public tags to a specific entity origin (project | post | experience). */
  source?: 'project' | 'post' | 'experience';
}

/**
 * List all tags (admin) or only tags used by published content (public).
 */
export async function listTags(filters: TagListFilters = {}, publicOnly = false) {
  if (publicOnly) {
    const key = `tags:public:category=${filters.category ?? ''}:source=${filters.source ?? ''}`;
    return cached(key, LIST_TTL, async () => {
      const result = await findManyTags(filters, true);
      return { ...result, data: result.data.map(mapTagRow) };
    });
  }
  const result = await findManyTags(filters, false);
  return { ...result, data: result.data.map(mapTagRow) };
}

/**
 * Create a new tag.
 * Auto-generates a slug from the name and enforces uniqueness.
 */
export async function createTagService(data: CreateTagSchemaInput) {
  const nameTaken = await findTagByName(data.name);
  if (nameTaken) {
    throw new Error(`CONFLICT: Tag name "${data.name}" is already taken`);
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
      throw new Error(`CONFLICT: Tag name "${data.name}" is already taken`);
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
 * The FK CASCADE on pivots ensures post_tags/project_tags are cleaned up.
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
 * Synchronize tags for a post or project.
 * Wraps the repository-level transactional sync.
 *
 * @param entityType - 'post' or 'project'
 * @param entityId   - ID of the post or project
 * @param tagIds     - Complete list of desired tag IDs (replaces existing)
 */
export async function syncTags(
  entityType: 'post' | 'project',
  entityId: number,
  tagIds: number[]
): Promise<void> {
  if (entityType === 'post') {
    await syncPostTags(entityId, tagIds);
    await invalidateGroup('postTagsSync');
  } else {
    await syncProjectTags(entityId, tagIds);
    await invalidateGroup('projectTagsSync');
  }
}
