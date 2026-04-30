/**
 * Skill referential integrity validation.
 *
 * Mirrors tagValidation.ts — asserts that every submitted skill ID exists
 * before any pivot write occurs, preventing opaque FK failures.
 */

import { findExistingSkillIds } from '../repositories/skills.repo';
import { DomainValidationError } from './errors';

export function normalizeSkillIds(skillIds: number[]): number[] {
  return Array.from(new Set(skillIds));
}

/**
 * Assert that every ID in `skillIds` exists in the skills table.
 *
 * - Empty array → no-op (valid: caller intends to clear all skills).
 * - All IDs exist → returns void.
 * - Any ID missing → throws with code `VALIDATION_ERROR`.
 */
export async function assertSkillsExist(skillIds: number[]): Promise<void> {
  const normalizedSkillIds = normalizeSkillIds(skillIds);
  if (normalizedSkillIds.length === 0) return;

  const existingIds = await findExistingSkillIds(normalizedSkillIds);
  const existingSet = new Set(existingIds);
  const missingIds = normalizedSkillIds.filter((id) => !existingSet.has(id));

  if (missingIds.length > 0) {
    throw new DomainValidationError(
      `One or more skillIds do not exist: ${missingIds.join(', ')}`,
      missingIds.map((id) => ({ field: 'skillIds', message: `Skill with id ${id} does not exist` }))
    );
  }
}
