import { contacts } from '@portfolio/shared/db/schema';
import { and, count, desc, eq, isNotNull, isNull, type SQL, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';

export interface ContactFilters {
  read?: boolean;
  page?: string | number;
  perPage?: string | number;
}

/** List contact messages with optional read filter. */
export async function findManyContacts(filters: ContactFilters = {}) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [];

  if (typeof filters.read === 'boolean') {
    if (filters.read) {
      conditions.push(isNotNull(contacts.readAt));
    } else {
      conditions.push(isNull(contacts.readAt));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(contacts).where(where),
    db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a contact by ID. */
export async function findContactById(id: number) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return row ?? null;
}

/** Create a contact message. */
export async function createContact(data: typeof contacts.$inferInsert) {
  const [row] = await db.insert(contacts).values(data).returning();
  return row;
}

/** Mark a contact as read. */
export async function markContactAsRead(id: number) {
  const [row] = await db
    .update(contacts)
    .set({ readAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  return row ?? null;
}

/**
 * Delete contact messages older than the given date.
 * Returns the number of deleted rows.
 */
export async function deleteOldContacts(olderThan: Date): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`
    DELETE FROM contacts
    WHERE created_at < ${olderThan}
    RETURNING 1
  `);
  return result.length;
}
