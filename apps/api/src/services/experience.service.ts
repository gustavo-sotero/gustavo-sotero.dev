/**
 * Service layer for experience entries.
 *
 * Handles: slug generation, uniqueness enforcement, date consistency
 * validation, cache invalidation, and tag synchronization.
 */

import { experience } from '@portfolio/shared/db/schema';
import type {
  CreateExperienceInput,
  UpdateExperienceInput,
} from '@portfolio/shared/schemas/experience';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { cached, invalidatePattern } from '../lib/cache';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import type { ExperienceFilters } from '../repositories/experience.repo';
import {
  createExperience,
  findExperienceById,
  findExperienceBySlug,
  findManyExperience,
  flattenExperienceTags,
  softDeleteExperience,
  updateExperience,
} from '../repositories/experience.repo';
import { syncExperienceTagsInTx } from '../repositories/tags.repo';

function normalizeTagIds(tagIds: number[]): number[] {
  return Array.from(new Set(tagIds));
}

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
  if (rows.length === 0) return false;
  const found = rows.at(0);
  if (found === undefined) return false;
  if (excludeId !== undefined) return found.id !== excludeId;
  return true;
}

// ── Date consistency validation ───────────────────────────────────────────────

function validateDates(startDate: string, endDate?: string | null, _isCurrent?: boolean): void {
  if (endDate && startDate && endDate < startDate) {
    throw new Error('VALIDATION_ERROR: endDate must be on or after startDate');
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
    return { ...result, data: result.data.map(flattenExperienceTags) };
  }

  const key = `experience:list:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 20}`;
  return cached(key, LIST_TTL, async () => {
    const result = await findManyExperience(filters, false);
    return { ...result, data: result.data.map(flattenExperienceTags) };
  });
}

/**
 * Get a single experience entry by slug.
 */
export async function getExperienceBySlug(slug: string, adminMode = false) {
  if (adminMode) {
    const entry = await findExperienceBySlug(slug, true);
    if (!entry) return null;
    return flattenExperienceTags(entry);
  }

  const key = `experience:slug:${slug}`;
  return cached(key, DETAIL_TTL, async () => {
    const entry = await findExperienceBySlug(slug, false);
    if (!entry) return null;
    return flattenExperienceTags(entry);
  });
}

/**
 * Get a single experience entry by ID (admin only).
 */
export async function getExperienceById(id: number) {
  const entry = await findExperienceById(id);
  if (!entry) return null;
  return flattenExperienceTags(entry);
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

  // Atomically write the experience row and sync tags in one transaction,
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
      },
      tx
    );

    if (!row) throw new Error('Failed to create experience — database returned no row');

    if (data.tagIds && data.tagIds.length > 0) {
      await syncExperienceTagsInTx(tx, row.id, normalizeTagIds(data.tagIds));
    }

    return row;
  });

  await invalidatePattern('experience:*');

  // Return with tags populated
  const full = await findExperienceById(entry.id);
  return full ? flattenExperienceTags(full) : flattenExperienceTags({ ...entry, tags: [] });
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

  // Atomically write the update and sync tags in one transaction.
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
      },
      tx
    );

    if (!row) return null;

    if (data.tagIds !== undefined) {
      await syncExperienceTagsInTx(tx, id, normalizeTagIds(data.tagIds));
    }

    return row;
  });

  if (!updated) return null;

  await invalidatePattern('experience:*');

  // Return with refreshed tags
  const full = await findExperienceById(id);
  return full ? flattenExperienceTags(full) : flattenExperienceTags({ ...updated, tags: [] });
}

/**
 * Soft-delete an experience entry.
 */
export async function softDeleteExperienceService(id: number) {
  const result = await softDeleteExperience(id);
  if (result) {
    await invalidatePattern('experience:*');
  }
  return result;
}
