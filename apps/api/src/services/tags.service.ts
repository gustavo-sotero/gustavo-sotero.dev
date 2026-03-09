/**
 * Service layer for tags.
 *
 * Handles tag CRUD with slug generation/uniqueness, cascade-aware deletion,
 * and cache invalidation. The pivot sync (`syncTags`) is delegated to the
 * repository which wraps pivot operations in a DB transaction.
 */

import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import type { CreateTagSchemaInput, UpdateTagSchemaInput } from '@portfolio/shared/schemas/tags';
import { cached, invalidatePattern } from '../lib/cache';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import {
  countHighlightedByCategory,
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

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_HIGHLIGHTED_PER_CATEGORY = 2;

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes

// ── Service methods ───────────────────────────────────────────────────────────

export interface TagListFilters {
  category?: string;
  page?: string | number;
  perPage?: string | number;
}

/**
 * List all tags (admin) or only tags used by published content (public).
 */
export async function listTags(filters: TagListFilters = {}, publicOnly = false) {
  if (publicOnly) {
    const key = `tags:public:category=${filters.category ?? ''}`;
    return cached(key, LIST_TTL, () => findManyTags(filters, true));
  }
  return findManyTags(filters, false);
}

/**
 * Create a new tag.
 * Auto-generates a slug from the name and enforces uniqueness.
 * Enforces the max-2-highlighted-per-category business rule.
 */
export async function createTagService(data: CreateTagSchemaInput) {
  const nameTaken = await findTagByName(data.name);
  if (nameTaken) {
    throw new Error(`CONFLICT: Tag name "${data.name}" is already taken`);
  }

  if (data.isHighlighted) {
    const category = data.category ?? 'other';
    const highlightCount = await countHighlightedByCategory(category);
    if (highlightCount >= MAX_HIGHLIGHTED_PER_CATEGORY) {
      throw new Error(
        `HIGHLIGHT_LIMIT: Category "${category}" already has ${MAX_HIGHLIGHTED_PER_CATEGORY} highlighted tags. Remove one before adding another.`
      );
    }
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
    isHighlighted: data.isHighlighted ?? false,
  });

  await invalidatePattern('tags:*');
  return tag;
}

/**
 * Update an existing tag by ID.
 * If `name` changes, regenerates the slug (ensuring uniqueness, excluding self).
 * Allows updating `category`, `name`, and `isHighlighted`.
 * `iconKey` is always recalculated server-side from the final name+category — never accepted from the client.
 * Enforces the max-2-highlighted-per-category business rule on the final state.
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
  if (data.isHighlighted !== undefined) patch.isHighlighted = data.isHighlighted;

  // Compute final effective name and category (after applying patch).
  const finalName = patch.name ?? current.name;
  const finalCategory = (patch.category ?? current.category) as Parameters<
    typeof resolveTagIcon
  >[1];

  // Always recalculate iconKey based on final name + category.
  // Backend is the authority — no manual iconKey accepted from client.
  const { iconKey: resolvedIconKey } = resolveTagIcon(finalName, finalCategory);
  if (resolvedIconKey !== current.iconKey) patch.iconKey = resolvedIconKey;

  // Validate highlight limit: compute final state after the patch
  const finalHighlighted = patch.isHighlighted ?? current.isHighlighted;

  if (finalHighlighted) {
    const highlightCount = await countHighlightedByCategory(finalCategory, id);
    if (highlightCount >= MAX_HIGHLIGHTED_PER_CATEGORY) {
      throw new Error(
        `HIGHLIGHT_LIMIT: Category "${finalCategory}" already has ${MAX_HIGHLIGHTED_PER_CATEGORY} highlighted tags. Remove one before adding another.`
      );
    }
  }

  if (Object.keys(patch).length === 0) return current; // nothing to update

  const updated = await updateTag(id, patch);

  // Invalidate tag cache and also any content that may reference this tag
  await Promise.all([
    invalidatePattern('tags:*'),
    invalidatePattern('posts:*'),
    invalidatePattern('projects:*'),
  ]);

  return updated;
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

  await Promise.all([
    invalidatePattern('tags:*'),
    invalidatePattern('posts:*'),
    invalidatePattern('projects:*'),
  ]);

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
    await Promise.all([invalidatePattern('posts:*'), invalidatePattern('tags:*')]);
  } else {
    await syncProjectTags(entityId, tagIds);
    await Promise.all([invalidatePattern('projects:*'), invalidatePattern('tags:*')]);
  }
}
