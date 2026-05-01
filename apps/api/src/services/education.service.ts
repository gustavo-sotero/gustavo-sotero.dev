/**
 * Service layer for education entries.
 *
 * Handles: slug generation, uniqueness enforcement, date consistency
 * validation, cache invalidation.
 */

import { education } from '@portfolio/shared/db/schema';
import type {
  CreateEducationInput,
  UpdateEducationInput,
} from '@portfolio/shared/schemas/education';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { cached, invalidateGroup } from '../lib/cache';
import { DomainValidationError } from '../lib/errors';
import type { TotalCountQueryOptions } from '../lib/pagination';
import { resolveSlugTaken } from '../lib/pivotHelpers';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import type { EducationFilters } from '../repositories/education.repo';
import {
  createEducation,
  findEducationById,
  findEducationBySlug,
  findManyEducation,
  softDeleteEducation,
  updateEducation,
} from '../repositories/education.repo';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes
const DETAIL_TTL = 3600; // 1 hour

// ── Slug uniqueness ───────────────────────────────────────────────────────────

async function educationSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: education.id })
    .from(education)
    .where(eq(education.slug, slug))
    .limit(1);
  return resolveSlugTaken(rows, excludeId);
}

// ── Date consistency validation ───────────────────────────────────────────────

function validateDates(startDate?: string | null, endDate?: string | null): void {
  if (startDate && endDate && endDate < startDate) {
    throw new DomainValidationError('endDate must be on or after startDate', [
      { field: 'endDate', message: 'endDate must be on or after startDate' },
    ]);
  }
}

// ── Service methods ───────────────────────────────────────────────────────────

export type { EducationFilters };

/**
 * List education entries (admin: all statuses; public: published + non-deleted).
 * Public results are cached.
 */
export async function listEducation(
  filters: EducationFilters,
  adminMode = false,
  options: TotalCountQueryOptions = {}
) {
  if (adminMode) {
    return findManyEducation(filters, true, options);
  }

  const key = `education:list:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 20}:includeTotal=${options.includeTotal === false ? '0' : '1'}`;
  return cached(key, LIST_TTL, () => findManyEducation(filters, false, options));
}

/**
 * Get a single education entry by slug.
 */
export async function getEducationBySlug(slug: string, adminMode = false) {
  if (adminMode) {
    return findEducationBySlug(slug, true);
  }

  const key = `education:slug:${slug}`;
  return cached(key, DETAIL_TTL, () => findEducationBySlug(slug, false));
}

/**
 * Get a single education entry by ID (admin only).
 */
export async function getEducationById(id: number) {
  return findEducationById(id);
}

/**
 * Create a new education entry.
 */
export async function createEducationService(data: CreateEducationInput) {
  // Validate date consistency
  validateDates(data.startDate, data.endDate);

  // Resolve slug from title + institution if not provided
  const baseSlug = data.slug ?? generateSlug(`${data.title} ${data.institution}`);
  const slug = await ensureUniqueSlug(baseSlug, (s) => educationSlugTaken(s));

  const entry = await createEducation({
    slug,
    title: data.title,
    institution: data.institution,
    description: data.description,
    location: data.location,
    educationType: data.educationType,
    startDate: data.startDate,
    endDate: data.endDate,
    isCurrent: data.isCurrent ?? false,
    workloadHours: data.workloadHours,
    credentialId: data.credentialId,
    credentialUrl: data.credentialUrl,
    order: data.order ?? 0,
    status: data.status ?? 'draft',
    logoUrl: data.logoUrl,
  });

  if (!entry) {
    throw new Error('Failed to create education — database returned no row');
  }

  await invalidateGroup('educationContent');

  return entry;
}

/**
 * Update an existing education entry.
 */
export async function updateEducationService(id: number, data: UpdateEducationInput) {
  const existing = await findEducationById(id);
  if (!existing) return null;

  // Validate date consistency with merged values
  const mergedStartDate = data.startDate !== undefined ? data.startDate : existing.startDate;
  const mergedEndDate = data.endDate !== undefined ? data.endDate : existing.endDate;

  validateDates(mergedStartDate, mergedEndDate);

  // Re-slug if slug is being changed
  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) {
    slug = await ensureUniqueSlug(data.slug, (s) => educationSlugTaken(s, id));
  }

  const updated = await updateEducation(id, {
    slug,
    title: data.title,
    institution: data.institution,
    description: data.description,
    location: data.location,
    educationType: data.educationType,
    startDate: data.startDate,
    endDate: data.endDate,
    isCurrent: data.isCurrent,
    workloadHours: data.workloadHours,
    credentialId: data.credentialId,
    credentialUrl: data.credentialUrl,
    order: data.order,
    status: data.status,
    logoUrl: data.logoUrl,
  });

  if (updated) {
    await invalidateGroup('educationContent');
  }

  return updated;
}

/**
 * Soft-delete an education entry.
 */
export async function softDeleteEducationService(id: number) {
  const result = await softDeleteEducation(id);
  if (result) {
    await invalidateGroup('educationContent');
  }
  return result;
}
