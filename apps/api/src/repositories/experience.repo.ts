import { experience } from '@portfolio/shared/db/schema';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';
import type { DbOrTx } from './tags.repo';

export interface ExperienceFilters {
  status?: 'draft' | 'published';
  page?: string | number;
  perPage?: string | number;
}

/**
 * Drizzle relational queries return pivot objects `{ experienceId, tagId, tag: Tag }[]`.
 * Flatten them to `Tag[]` so the JSON response conforms to the shared `Experience` type.
 */
export function flattenExperienceTags<T extends { tags?: Array<{ tag: unknown }> }>(item: T) {
  return {
    ...item,
    tags: (item.tags ?? []).map((pivot) => pivot.tag),
  };
}

/**
 * Deterministic ordering:
 *  1. order ASC
 *  2. is_current DESC (current items appear first within same order)
 *  3. start_date DESC
 *  4. created_at DESC
 */
const ORDER_BY = [
  experience.order,
  desc(experience.isCurrent),
  desc(experience.startDate),
  desc(experience.createdAt),
] as const;

/**
 * List experience entries (with their associated tags).
 * Public mode enforces `published` + non-deleted.
 * Admin mode includes all; optionally filters by status.
 */
export async function findManyExperience(filters: ExperienceFilters, adminMode = false) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [isNull(experience.deletedAt)];

  if (!adminMode) {
    conditions.push(eq(experience.status, 'published'));
  } else if (filters.status) {
    conditions.push(eq(experience.status, filters.status));
  }

  const where = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(experience).where(where),
    db.query.experience.findMany({
      where,
      orderBy: [...ORDER_BY],
      limit,
      offset,
      with: {
        tags: {
          with: { tag: true },
        },
      },
    }),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a single experience entry by slug (with tags). */
export async function findExperienceBySlug(slug: string, adminMode = false) {
  const conditions: SQL[] = [eq(experience.slug, slug), isNull(experience.deletedAt)];

  if (!adminMode) {
    conditions.push(eq(experience.status, 'published'));
  }

  const row = await db.query.experience.findFirst({
    where: and(...conditions),
    with: {
      tags: {
        with: { tag: true },
      },
    },
  });

  return row ?? null;
}

/** Find a single experience entry by numeric ID (admin only, with tags). */
export async function findExperienceById(id: number) {
  const row = await db.query.experience.findFirst({
    where: and(eq(experience.id, id), isNull(experience.deletedAt)),
    with: {
      tags: {
        with: { tag: true },
      },
    },
  });

  return row ?? null;
}

/** Create a new experience entry. */
export async function createExperience(data: typeof experience.$inferInsert, dbOrTx: DbOrTx = db) {
  const [row] = await dbOrTx.insert(experience).values(data).returning();
  return row;
}

/** Update an experience entry by ID. */
export async function updateExperience(
  id: number,
  data: Partial<typeof experience.$inferInsert>,
  dbOrTx: DbOrTx = db
) {
  const [row] = await dbOrTx
    .update(experience)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(experience.id, id), isNull(experience.deletedAt)))
    .returning();
  return row ?? null;
}

/** Soft-delete an experience entry by ID. */
export async function softDeleteExperience(id: number) {
  const [row] = await db
    .update(experience)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(experience.id, id), isNull(experience.deletedAt)))
    .returning({ id: experience.id });
  return row ?? null;
}
