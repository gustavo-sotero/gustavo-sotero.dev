import type * as schema from '@portfolio/shared/db/schema';
import {
  experience,
  experienceTags,
  posts,
  postTags,
  projects,
  projectTags,
  tags,
} from '@portfolio/shared/db/schema';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { and, asc, count, eq, exists, inArray, isNull, ne, or, type SQL, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';
import { publicPostVisibilityClauses } from './posts.repo';

/**
 * Database-or-transaction type — accepts both the global Drizzle `db` instance
 * and the `tx` callback parameter from `db.transaction()`.
 *
 * `PgTransaction` is structurally different from `PostgresJsDatabase` ($client is absent),
 * so we use a union type to allow both call sites.
 */
export type DbOrTx =
  | typeof db
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;

export interface TagFilters {
  category?: string | string[];
  page?: string | number;
  perPage?: string | number;
}

/** Find all tags (admin: all; public: only those in use by published content). */
export async function findManyTags(filters: TagFilters = {}, publicOnly = false) {
  const shouldPaginate = filters.page !== undefined || filters.perPage !== undefined;
  const pagination = shouldPaginate
    ? parsePagination({
        page: filters.page,
        perPage: filters.perPage,
      })
    : null;
  const page = pagination?.page ?? 1;
  const perPage = pagination?.perPage ?? Number.MAX_SAFE_INTEGER;
  const offset = pagination?.offset ?? 0;
  const limit = pagination?.limit;

  const conditions: SQL[] = [];

  // Category filter: accept comma-separated or array
  const rawCategory = filters.category;
  if (rawCategory) {
    const cats = Array.isArray(rawCategory)
      ? rawCategory
      : rawCategory
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
    if (cats.length > 0) {
      conditions.push(
        inArray(
          tags.category,
          cats as ('language' | 'framework' | 'tool' | 'db' | 'cloud' | 'infra' | 'other')[]
        )
      );
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (publicOnly) {
    // Only tags used by at least one published post, project, or experience.
    // Uses EXISTS subqueries to avoid materializing an intermediate ID array in memory —
    // the filter is pushed entirely to the database engine as a correlated subquery.
    const isUsedCondition = or(
      exists(
        db
          .select({ one: sql<number>`1` })
          .from(postTags)
          .innerJoin(posts, eq(postTags.postId, posts.id))
          .where(and(eq(postTags.tagId, tags.id), ...publicPostVisibilityClauses(posts)))
      ),
      exists(
        db
          .select({ one: sql<number>`1` })
          .from(projectTags)
          .innerJoin(projects, eq(projectTags.projectId, projects.id))
          .where(
            and(
              eq(projectTags.tagId, tags.id),
              eq(projects.status, 'published'),
              isNull(projects.deletedAt)
            )
          )
      ),
      exists(
        db
          .select({ one: sql<number>`1` })
          .from(experienceTags)
          .innerJoin(experience, eq(experienceTags.experienceId, experience.id))
          .where(
            and(
              eq(experienceTags.tagId, tags.id),
              eq(experience.status, 'published'),
              isNull(experience.deletedAt)
            )
          )
      )
    );

    const publicConditions: SQL[] = [...conditions, isUsedCondition as SQL];
    const publicWhere = publicConditions.length > 0 ? and(...publicConditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db.select({ total: count() }).from(tags).where(publicWhere),
      limit === undefined
        ? db.select().from(tags).where(publicWhere).orderBy(asc(tags.category), asc(tags.name))
        : db
            .select()
            .from(tags)
            .where(publicWhere)
            .orderBy(asc(tags.category), asc(tags.name))
            .limit(limit)
            .offset(offset),
    ]);

    const total = countResult[0]?.total ?? 0;
    return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
  }

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(tags).where(where),
    limit === undefined
      ? db.select().from(tags).where(where).orderBy(asc(tags.category), asc(tags.name))
      : db
          .select()
          .from(tags)
          .where(where)
          .orderBy(asc(tags.category), asc(tags.name))
          .limit(limit)
          .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a tag by ID. */
export async function findTagById(id: number) {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ?? null;
}

/** Find a tag by slug. */
export async function findTagBySlug(slug: string) {
  const [row] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return row ?? null;
}

/** Find a tag by name (case-insensitive). */
export async function findTagByName(name: string) {
  const [row] = await db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name})`)
    .limit(1);
  return row ?? null;
}

/** Check if a slug is available, optionally excluding an ID. */
export async function tagSlugExists(slug: string, excludeId?: number): Promise<boolean> {
  const conditions: SQL[] = [eq(tags.slug, slug)];
  if (excludeId !== undefined) {
    conditions.push(sql`${tags.id} != ${excludeId}`);
  }
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

/** Check if a tag name is available, optionally excluding an ID (case-insensitive). */
export async function tagNameExists(name: string, excludeId?: number): Promise<boolean> {
  const conditions: SQL[] = [sql`lower(${tags.name}) = lower(${name})` as SQL];
  if (excludeId !== undefined) {
    conditions.push(sql`${tags.id} != ${excludeId}`);
  }
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

/**
 * Count highlighted tags in a category.
 * Optionally excludes a tag by ID (used during updates to exclude self).
 */
export async function countHighlightedByCategory(
  category: string,
  excludeId?: number
): Promise<number> {
  const cat = category as 'language' | 'framework' | 'tool' | 'db' | 'cloud' | 'infra' | 'other';
  const conditions: SQL[] = [eq(tags.category, cat), eq(tags.isHighlighted, true)];
  if (excludeId !== undefined) {
    conditions.push(ne(tags.id, excludeId));
  }
  const [row] = await db
    .select({ total: count() })
    .from(tags)
    .where(and(...conditions));
  return row?.total ?? 0;
}

/** Create a tag. */
export async function createTag(data: typeof tags.$inferInsert) {
  const [row] = await db.insert(tags).values(data).returning();
  return row;
}

/** Update a tag by ID. */
export async function updateTag(id: number, data: Partial<typeof tags.$inferInsert>) {
  const [row] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
  return row ?? null;
}

/** Delete a tag by ID (hard delete — pivots CASCADE). */
export async function deleteTag(id: number) {
  const [row] = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  return row ?? null;
}

/** Sync tags for a post: replace all existing pivot entries. */
export async function syncPostTags(postId: number, tagIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(postTags).where(eq(postTags.postId, postId));
    if (tagIds.length > 0) {
      await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
    }
  });
}

/**
 * Sync tags for a post within an existing transaction.
 * Use this inside `db.transaction()` blocks so the tag sync is atomic with
 * the surrounding post create/update, avoiding partial updates on failure.
 */
export async function syncPostTagsInTx(tx: DbOrTx, postId: number, tagIds: number[]) {
  await tx.delete(postTags).where(eq(postTags.postId, postId));
  if (tagIds.length > 0) {
    await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
  }
}

/** Sync tags for a project: replace all existing pivot entries. */
export async function syncProjectTags(projectId: number, tagIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(projectTags).where(eq(projectTags.projectId, projectId));
    if (tagIds.length > 0) {
      await tx.insert(projectTags).values(tagIds.map((tagId) => ({ projectId, tagId })));
    }
  });
}

/**
 * Sync tags for a project within an existing transaction.
 * Use this inside `db.transaction()` blocks so the tag sync is atomic with
 * the surrounding project create/update, avoiding partial updates on failure.
 */
export async function syncProjectTagsInTx(tx: DbOrTx, projectId: number, tagIds: number[]) {
  await tx.delete(projectTags).where(eq(projectTags.projectId, projectId));
  if (tagIds.length > 0) {
    await tx.insert(projectTags).values(tagIds.map((tagId) => ({ projectId, tagId })));
  }
}

/** Sync tags for an experience: replace all existing pivot entries. */
export async function syncExperienceTags(experienceId: number, tagIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(experienceTags).where(eq(experienceTags.experienceId, experienceId));
    if (tagIds.length > 0) {
      await tx.insert(experienceTags).values(tagIds.map((tagId) => ({ experienceId, tagId })));
    }
  });
}

/** Sync tags for an experience within an existing transaction. */
export async function syncExperienceTagsInTx(tx: DbOrTx, experienceId: number, tagIds: number[]) {
  await tx.delete(experienceTags).where(eq(experienceTags.experienceId, experienceId));
  if (tagIds.length > 0) {
    await tx.insert(experienceTags).values(tagIds.map((tagId) => ({ experienceId, tagId })));
  }
}
