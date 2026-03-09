import { education } from '@portfolio/shared/db/schema';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';

export interface EducationFilters {
  status?: 'draft' | 'published';
  page?: string | number;
  perPage?: string | number;
}

/**
 * Deterministic ordering:
 *  1. order ASC
 *  2. is_current DESC
 *  3. start_date DESC (nulls last)
 *  4. created_at DESC
 */
const ORDER_BY = [
  education.order,
  desc(education.isCurrent),
  desc(education.startDate),
  desc(education.createdAt),
] as const;

/**
 * List education entries.
 * Public mode enforces `published` + non-deleted.
 * Admin mode includes all; optionally filters by status.
 */
export async function findManyEducation(filters: EducationFilters, adminMode = false) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [isNull(education.deletedAt)];

  if (!adminMode) {
    conditions.push(eq(education.status, 'published'));
  } else if (filters.status) {
    conditions.push(eq(education.status, filters.status));
  }

  const where = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(education).where(where),
    db
      .select()
      .from(education)
      .where(where)
      .orderBy(...ORDER_BY)
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a single education entry by slug. */
export async function findEducationBySlug(slug: string, adminMode = false) {
  const conditions: SQL[] = [eq(education.slug, slug), isNull(education.deletedAt)];

  if (!adminMode) {
    conditions.push(eq(education.status, 'published'));
  }

  const row = await db
    .select()
    .from(education)
    .where(and(...conditions))
    .limit(1);

  return row[0] ?? null;
}

/** Find a single education entry by numeric ID (admin only). */
export async function findEducationById(id: number) {
  const row = await db
    .select()
    .from(education)
    .where(and(eq(education.id, id), isNull(education.deletedAt)))
    .limit(1);

  return row[0] ?? null;
}

/** Create a new education entry. */
export async function createEducation(data: typeof education.$inferInsert) {
  const [row] = await db.insert(education).values(data).returning();
  return row;
}

/** Update an education entry by ID. */
export async function updateEducation(id: number, data: Partial<typeof education.$inferInsert>) {
  const [row] = await db
    .update(education)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(education.id, id), isNull(education.deletedAt)))
    .returning();
  return row ?? null;
}

/** Soft-delete an education entry by ID. */
export async function softDeleteEducation(id: number) {
  const [row] = await db
    .update(education)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(education.id, id), isNull(education.deletedAt)))
    .returning({ id: education.id });
  return row ?? null;
}
