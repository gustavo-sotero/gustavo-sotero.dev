import { experienceSkills, projectSkills, skills } from '@portfolio/shared/db/schema';
import { and, asc, count, eq, inArray, ne, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import {
  buildPaginationMeta,
  parsePagination,
  type TotalCountQueryOptions,
} from '../lib/pagination';
import type { DbOrTx } from './tags.repo';

export interface SkillFilters {
  category?: string | string[];
  highlighted?: boolean;
  page?: string | number;
  perPage?: string | number;
}

function resolveSkillListState(filters: SkillFilters = {}) {
  const shouldPaginate = filters.page !== undefined || filters.perPage !== undefined;
  const pagination = shouldPaginate
    ? parsePagination({ page: filters.page, perPage: filters.perPage })
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
          skills.category,
          cats as ('language' | 'framework' | 'tool' | 'db' | 'cloud' | 'infra')[]
        )
      );
    }
  }

  if (typeof filters.highlighted === 'boolean') {
    conditions.push(eq(skills.isHighlighted, filters.highlighted ? 1 : 0));
  }

  return {
    page,
    perPage,
    offset,
    limit,
    where: conditions.length > 0 ? and(...conditions) : undefined,
  };
}

async function querySkillRows(filters: SkillFilters = {}) {
  const { page, perPage, offset, limit, where } = resolveSkillListState(filters);
  const rows =
    limit === undefined
      ? await db.select().from(skills).where(where).orderBy(asc(skills.category), asc(skills.name))
      : await db
          .select()
          .from(skills)
          .where(where)
          .orderBy(asc(skills.category), asc(skills.name))
          .limit(limit)
          .offset(offset);

  return { rows, page, perPage, where };
}

export async function findManySkills(
  filters: SkillFilters = {},
  options: TotalCountQueryOptions = {}
) {
  const { rows, page, perPage, where } = await querySkillRows(filters);

  if (options.includeTotal === false) {
    return {
      data: rows,
      meta: buildPaginationMeta(rows.length, page, perPage),
    };
  }

  const countResult = await db.select({ total: count() }).from(skills).where(where);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

export async function findSkillById(id: number) {
  const [row] = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  return row ?? null;
}

export async function findExistingSkillIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids));
  return rows.map((r) => r.id);
}

export async function findSkillBySlug(slug: string) {
  const [row] = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
  return row ?? null;
}

export async function findSkillByName(name: string) {
  const [row] = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  return row ?? null;
}

export async function skillSlugExists(slug: string, excludeId?: number): Promise<boolean> {
  const conditions: SQL[] = [eq(skills.slug, slug)];
  if (excludeId !== undefined) conditions.push(ne(skills.id, excludeId));
  const [row] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

export async function skillNameExists(name: string, excludeId?: number): Promise<boolean> {
  const conditions: SQL[] = [eq(skills.name, name)];
  if (excludeId !== undefined) conditions.push(ne(skills.id, excludeId));
  const [row] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

export async function countHighlightedSkillsByCategory(
  category: string,
  excludeId?: number
): Promise<number> {
  const cat = category as 'language' | 'framework' | 'tool' | 'db' | 'cloud' | 'infra';
  const conditions: SQL[] = [eq(skills.category, cat), eq(skills.isHighlighted, 1)];
  if (excludeId !== undefined) conditions.push(ne(skills.id, excludeId));
  const [row] = await db
    .select({ total: count() })
    .from(skills)
    .where(and(...conditions));
  return row?.total ?? 0;
}

export async function createSkill(data: typeof skills.$inferInsert) {
  const [row] = await db.insert(skills).values(data).returning();
  return row;
}

export async function updateSkill(id: number, data: Partial<typeof skills.$inferInsert>) {
  const [row] = await db.update(skills).set(data).where(eq(skills.id, id)).returning();
  return row ?? null;
}

export async function deleteSkill(id: number) {
  const [row] = await db.delete(skills).where(eq(skills.id, id)).returning({ id: skills.id });
  return row ?? null;
}

export async function syncProjectSkills(projectId: number, skillIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(projectSkills).where(eq(projectSkills.projectId, projectId));
    if (skillIds.length > 0) {
      await tx.insert(projectSkills).values(skillIds.map((skillId) => ({ projectId, skillId })));
    }
  });
}

export async function syncProjectSkillsInTx(tx: DbOrTx, projectId: number, skillIds: number[]) {
  await tx.delete(projectSkills).where(eq(projectSkills.projectId, projectId));
  if (skillIds.length > 0) {
    await tx.insert(projectSkills).values(skillIds.map((skillId) => ({ projectId, skillId })));
  }
}

export async function syncExperienceSkills(experienceId: number, skillIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(experienceSkills).where(eq(experienceSkills.experienceId, experienceId));
    if (skillIds.length > 0) {
      await tx
        .insert(experienceSkills)
        .values(skillIds.map((skillId) => ({ experienceId, skillId })));
    }
  });
}

export async function syncExperienceSkillsInTx(
  tx: DbOrTx,
  experienceId: number,
  skillIds: number[]
) {
  await tx.delete(experienceSkills).where(eq(experienceSkills.experienceId, experienceId));
  if (skillIds.length > 0) {
    await tx
      .insert(experienceSkills)
      .values(skillIds.map((skillId) => ({ experienceId, skillId })));
  }
}
