import { projectSkills, projects, skills } from '@portfolio/shared/db/schema';
import { and, count, eq, exists, isNull, type SQL, sql } from 'drizzle-orm';
import { db } from '../config/db';
import {
  buildPaginationMeta,
  buildWindowedResult,
  parsePagination,
  type TotalCountQueryOptions,
} from '../lib/pagination';
import type { DbOrTx } from './tags.repo';

export interface ProjectFilters {
  status?: 'draft' | 'published';
  skill?: string;
  featured?: boolean;
  featuredFirst?: boolean;
  page?: string | number;
  perPage?: string | number;
}

function resolveProjectListState(filters: ProjectFilters, adminMode: boolean) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [];

  if (!adminMode) {
    conditions.push(eq(projects.status, 'published'));
    conditions.push(isNull(projects.deletedAt));
  } else {
    conditions.push(isNull(projects.deletedAt));
    if (filters.status) {
      conditions.push(eq(projects.status, filters.status));
    }
  }

  if (typeof filters.featured === 'boolean') {
    conditions.push(eq(projects.featured, filters.featured));
  }

  if (filters.skill) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(projectSkills)
          .innerJoin(skills, eq(projectSkills.skillId, skills.id))
          .where(and(eq(projectSkills.projectId, projects.id), eq(skills.slug, filters.skill)))
      )
    );
  }

  return {
    page,
    perPage,
    offset,
    limit,
    where: conditions.length > 0 ? and(...conditions) : undefined,
  };
}

async function queryProjectRows(
  filters: ProjectFilters,
  adminMode: boolean,
  summaryOnly = false,
  probeNextPage = false
) {
  const { page, perPage, offset, limit, where } = resolveProjectListState(filters, adminMode);
  const rows = await db.query.projects.findMany({
    where,
    orderBy: filters.featuredFirst
      ? sql`${projects.featured} DESC, ${projects.order} ASC, ${projects.createdAt} DESC`
      : sql`${projects.createdAt} DESC`,
    limit: limit + (probeNextPage ? 1 : 0),
    offset,
    ...(summaryOnly ? { columns: { content: false, renderedContent: false } } : {}),
    with: {
      skills: {
        with: { skill: true },
      },
    },
  });

  return { rows, page, perPage, where };
}

/**
 * List projects for public consumption (published + not deleted)
 * or admin (all statuses, filter optional).
 */
export async function findManyProjects(
  filters: ProjectFilters,
  adminMode = false,
  options: TotalCountQueryOptions & { summaryOnly?: boolean } = {}
) {
  const { rows, page, perPage, where } = await queryProjectRows(
    filters,
    adminMode,
    options.summaryOnly,
    options.includeTotal === false
  );

  if (options.includeTotal === false) {
    return buildWindowedResult(rows, page, perPage);
  }

  const countResult = await db.select({ total: count() }).from(projects).where(where);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a project by slug. Returns with skills. */
export async function findProjectBySlug(slug: string, adminMode = false) {
  const conditions: SQL[] = [eq(projects.slug, slug)];
  if (adminMode) {
    conditions.push(isNull(projects.deletedAt));
  } else {
    conditions.push(isNull(projects.deletedAt));
    conditions.push(eq(projects.status, 'published'));
  }

  const row = await db.query.projects.findFirst({
    where: and(...conditions),
    with: {
      skills: {
        with: { skill: true },
      },
    },
  });

  return row ?? null;
}

/** Create a new project. */
export async function createProject(data: typeof projects.$inferInsert, dbOrTx: DbOrTx = db) {
  const [row] = await dbOrTx.insert(projects).values(data).returning();
  return row;
}

/** Update a project by ID. */
export async function updateProject(
  id: number,
  data: Partial<typeof projects.$inferInsert>,
  dbOrTx: DbOrTx = db
) {
  const [row] = await dbOrTx
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .returning();
  return row ?? null;
}

/** Soft-delete a project by ID. */
export async function softDeleteProject(id: number) {
  const [row] = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .returning({ id: projects.id });
  return row ?? null;
}
