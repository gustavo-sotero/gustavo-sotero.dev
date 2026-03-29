/**
 * Tag referential integrity validation.
 *
 * Validates a submitted set of tag IDs against the database before any pivot
 * writes occur. Throws a deterministic domain error (VALIDATION_ERROR) when
 * one or more IDs do not exist, preventing opaque 500 failures caused by
 * foreign-key violations in the pivot tables.
 */

import { findExistingTagIds } from '../repositories/tags.repo';

export function normalizeTagIds(tagIds: number[]): number[] {
  return Array.from(new Set(tagIds));
}

/**
 * Assert that every ID in `tagIds` exists in the tags table.
 *
 * Behavior:
 *  - Empty array → no-op (valid: caller intends to clear all tags).
 *  - All IDs exist → returns void.
 *  - Any ID missing → throws with code `VALIDATION_ERROR` and an
 *    `invalidTagIds` property listing the unknown IDs.
 */
export async function assertTagsExist(tagIds: number[]): Promise<void> {
  const normalizedTagIds = normalizeTagIds(tagIds);
  if (normalizedTagIds.length === 0) return;

  const existingIds = await findExistingTagIds(normalizedTagIds);
  const existingSet = new Set(existingIds);
  const missingIds = normalizedTagIds.filter((id) => !existingSet.has(id));

  if (missingIds.length > 0) {
    throw Object.assign(
      new Error(`VALIDATION_ERROR: One or more tagIds do not exist: ${missingIds.join(', ')}`),
      { invalidTagIds: missingIds }
    );
  }
}
