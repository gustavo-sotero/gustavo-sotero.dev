import { uploads } from '@portfolio/shared/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';

export interface UploadFilters {
  status?: 'pending' | 'uploaded' | 'processed' | 'failed';
  page?: string | number;
  perPage?: string | number;
}

/** List uploads with optional status filter. */
export async function findManyUploads(filters: UploadFilters = {}) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const where = filters.status ? eq(uploads.status, filters.status) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(uploads).where(where),
    db
      .select()
      .from(uploads)
      .where(where)
      .orderBy(desc(uploads.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find an upload by ID. */
export async function findUploadById(id: string) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  return row ?? null;
}

/** Create an upload record. */
export async function createUpload(data: typeof uploads.$inferInsert) {
  const [row] = await db.insert(uploads).values(data).returning();
  return row;
}

/** Update an upload record. */
export async function updateUpload(id: string, data: Partial<typeof uploads.$inferInsert>) {
  const [row] = await db.update(uploads).set(data).where(eq(uploads.id, id)).returning();
  return row ?? null;
}
