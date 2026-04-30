/**
 * Service layer for experience entries.
 *
 * Handles: slug generation, uniqueness enforcement, date consistency
 * validation, cache invalidation, and skills synchronization.
 */

import { experience } from '@portfolio/shared/db/schema';
import type {
  CreateExperienceInput,
  UpdateExperienceInput,
} from '@portfolio/shared/schemas/experience';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { cached, invalidateGroup } from '../lib/cache';
import { DomainValidationError } from '../lib/errors';
import { normalizeExperienceImpactFacts } from '../lib/impactFacts';
import { flattenPivotSkills, resolveSlugTaken } from '../lib/pivotHelpers';
import { assertSkillsExist, normalizeSkillIds } from '../lib/skillValidation';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import type { ExperienceFilters } from '../repositories/experience.repo';
import {
  createExperience,
  findExperienceById,
  findExperienceBySlug,
  findManyExperience,
  softDeleteExperience,
  updateExperience,
} from '../repositories/experience.repo';
import { syncExperienceSkillsInTx } from '../repositories/skills.repo';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes
const DETAIL_TTL = 3600; // 1 hour

// ── Slug uniqueness ───────────────────────────────────────────────────────────

async function experienceSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: experience.id })
    .from(experience)
    .where(eq(experience.slug, slug))
    .limit(1);
  return resolveSlugTaken(rows, excludeId);
}

// ── Date consistency validation ───────────────────────────────────────────────

function validateDates(startDate: string, endDate?: string | null, isCurrent?: boolean): void {
  if (!isCurrent && !endDate) {
    throw new DomainValidationError('endDate is required when isCurrent is false', [
      { field: 'endDate', message: 'endDate is required when isCurrent is false' },
    ]);
  }
  if (endDate && startDate && endDate < startDate) {
    throw new DomainValidationError('endDate must be on or after startDate', [
      { field: 'endDate', message: 'endDate must be on or after startDate' },
    ]);
  }
}

// ── Service methods ───────────────────────────────────────────────────────────

export type { ExperienceFilters };

/**
 * List experience entries (admin: all statuses; public: published + non-deleted).
 * Public results are cached.
 */
export async function listExperience(filters: ExperienceFilters, adminMode = false) {
  if (adminMode) {
    const result = await findManyExperience(filters, true);
    return { ...result, data: result.data.map(flattenPivotSkills) };
  }

  const key = `experience:list:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 20}`;
  return cached(key, LIST_TTL, async () => {
    const result = await findManyExperience(filters, false);
    return { ...result, data: result.data.map(flattenPivotSkills) };
  });
}

/**
 * Get a single experience entry by slug.
 */
export async function getExperienceBySlug(slug: string, adminMode = false) {
  if (adminMode) {
    const entry = await findExperienceBySlug(slug, true);
    if (!entry) return null;
    return flattenPivotSkills(entry);
  }

  const key = `experience:slug:${slug}`;
  return cached(key, DETAIL_TTL, async () => {
    const entry = await findExperienceBySlug(slug, false);
    if (!entry) return null;
    return flattenPivotSkills(entry);
  });
}

/**
 * Get a single experience entry by ID (admin only).
 */
export async function getExperienceById(id: number) {
  const entry = await findExperienceById(id);
  if (!entry) return null;
  return flattenPivotSkills(entry);
}

/**
 * Create a new experience entry.
 */
export async function createExperienceService(data: CreateExperienceInput) {
  // Validate date consistency
  validateDates(data.startDate, data.endDate, data.isCurrent);

  // Resolve slug from role + company if not provided
  const baseSlug = data.slug ?? generateSlug(`${data.role} ${data.company}`);
  const slug = await ensureUniqueSlug(baseSlug, (s) => experienceSlugTaken(s));

  // Validate skill references before entering the transaction
  const normalizedSkillIds = data.skillIds ? normalizeSkillIds(data.skillIds) : [];
  const normalizedImpactFacts = normalizeExperienceImpactFacts(data.impactFacts) ?? [];
  await assertSkillsExist(normalizedSkillIds);

  // Atomically write the experience row and sync skills in one transaction,
  // matching the same consistency guarantee used in posts/projects services.
  const entry = await db.transaction(async (tx) => {
    const row = await createExperience(
      {
        slug,
        role: data.role,
        company: data.company,
        description: data.description,
        location: data.location,
        employmentType: data.employmentType,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent ?? false,
        order: data.order ?? 0,
        status: data.status ?? 'draft',
        logoUrl: data.logoUrl,
        credentialUrl: data.credentialUrl,
        impactFacts: normalizedImpactFacts,
      },
      tx
    );

    if (!row) throw new Error('Failed to create experience — database returned no row');

    if (normalizedSkillIds.length > 0) {
      await syncExperienceSkillsInTx(tx, row.id, normalizedSkillIds);
    }

    return row;
  });

  await invalidateGroup('experienceContent');

  // Return with skills populated
  const full = await findExperienceById(entry.id);
  return full ? flattenPivotSkills(full) : flattenPivotSkills({ ...entry, skills: [] });
}

/**
 * Update an existing experience entry.
 */
export async function updateExperienceService(id: number, data: UpdateExperienceInput) {
  const existing = await findExperienceById(id);
  if (!existing) return null;

  // Validate date consistency with merged values
  const mergedStartDate = data.startDate ?? existing.startDate;
  const mergedEndDate = data.endDate !== undefined ? data.endDate : existing.endDate;
  const mergedIsCurrent = data.isCurrent !== undefined ? data.isCurrent : existing.isCurrent;

  validateDates(mergedStartDate, mergedEndDate, mergedIsCurrent);

  // Re-slug if slug is being changed
  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) {
    slug = await ensureUniqueSlug(data.slug, (s) => experienceSlugTaken(s, id));
  }

  // Validate skill references before entering the transaction.
  const normalizedSkillIds =
    data.skillIds !== undefined ? normalizeSkillIds(data.skillIds) : undefined;

  await (normalizedSkillIds !== undefined
    ? assertSkillsExist(normalizedSkillIds)
    : Promise.resolve());

  // Atomically write the update and sync skills in one transaction.
  const updated = await db.transaction(async (tx) => {
    const row = await updateExperience(
      id,
      {
        slug,
        role: data.role,
        company: data.company,
        description: data.description,
        location: data.location,
        employmentType: data.employmentType,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent,
        order: data.order,
        status: data.status,
        logoUrl: data.logoUrl,
        credentialUrl: data.credentialUrl,
        impactFacts:
          data.impactFacts === undefined
            ? undefined
            : normalizeExperienceImpactFacts(data.impactFacts),
      },
      tx
    );

    if (!row) return null;

    if (normalizedSkillIds !== undefined) {
      await syncExperienceSkillsInTx(tx, id, normalizedSkillIds);
    }

    return row;
  });

  if (!updated) return null;

  await invalidateGroup('experienceContent');

  // Return with refreshed skills
  const full = await findExperienceById(id);
  return full ? flattenPivotSkills(full) : flattenPivotSkills({ ...updated, skills: [] });
}

/**
 * Soft-delete an experience entry.
 */
export async function softDeleteExperienceService(id: number) {
  const result = await softDeleteExperience(id);
  if (result) {
    await invalidateGroup('experienceContent');
  }
  return result;
}
