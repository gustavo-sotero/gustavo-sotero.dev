import type * as schema from '@portfolio/shared/db/schema';
import { posts, postTags, tags } from '@portfolio/shared/db/schema';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { and, asc, count, eq, exists, inArray, type SQL, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db } from '../config/db';
import {
  buildPaginationMeta,
  parsePagination,
  type TotalCountQueryOptions,
} from '../lib/pagination';
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
  /** Restrict public tags to a specific entity origin. Tags are now only associated with posts. */
  source?: 'post';
}

function resolveTagListState(filters: TagFilters = {}) {
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

  return {
    page,
    perPage,
    offset,
    limit,
    conditions,
    where: conditions.length > 0 ? and(...conditions) : undefined,
  };
}

async function queryTagRows(filters: TagFilters = {}, publicOnly = false) {
  const { page, perPage, offset, limit, conditions, where } = resolveTagListState(filters);

  if (publicOnly) {
    const postExists = exists(
      db
        .select({ one: sql<number>`1` })
        .from(postTags)
        .innerJoin(posts, eq(postTags.postId, posts.id))
        .where(and(eq(postTags.tagId, tags.id), ...publicPostVisibilityClauses(posts)))
    );

    const publicConditions: SQL[] = [...conditions, postExists as SQL];
    const publicWhere = publicConditions.length > 0 ? and(...publicConditions) : undefined;
    const rows =
      limit === undefined
        ? await db
            .select()
            .from(tags)
            .where(publicWhere)
            .orderBy(asc(tags.category), asc(tags.name))
        : await db
            .select()
            .from(tags)
            .where(publicWhere)
            .orderBy(asc(tags.category), asc(tags.name))
            .limit(limit)
            .offset(offset);

    return { rows, page, perPage, where: publicWhere };
  }

  const rows =
    limit === undefined
      ? await db.select().from(tags).where(where).orderBy(asc(tags.category), asc(tags.name))
      : await db
          .select()
          .from(tags)
          .where(where)
          .orderBy(asc(tags.category), asc(tags.name))
          .limit(limit)
          .offset(offset);

  return { rows, page, perPage, where };
}

/** Find all tags (admin: all; public: only those in use by published content). */
export async function findManyTags(
  filters: TagFilters = {},
  publicOnly = false,
  options: TotalCountQueryOptions = {}
) {
  const { rows, page, perPage, where } = await queryTagRows(filters, publicOnly);

  if (options.includeTotal === false) {
    return {
      data: rows,
      meta: buildPaginationMeta(rows.length, page, perPage),
    };
  }

  const countResult = await db.select({ total: count() }).from(tags).where(where);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a tag by ID. */
export async function findTagById(id: number) {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ?? null;
}

/**
 * Given a list of tag IDs, return the subset that actually exists in the database.
 * Use this before pivot writes to detect invalid references without opening a transaction.
 * Returns an empty array for empty input.
 */
export async function findExistingTagIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, ids));
  return rows.map((r) => r.id);
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

/** Minimal tag projection for AI tag canonicalization. */
export async function findAllTagsForNormalization() {
  return db.select({ name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name));
}

/**
 * Find tags by a list of canonical slugs in a single query.
 * Returns only the tags that exist — unmatched slugs produce no entry.
 * Returns an empty array for empty input.
 */
export async function findTagsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  return db.select().from(tags).where(inArray(tags.slug, slugs)).orderBy(asc(tags.name));
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
