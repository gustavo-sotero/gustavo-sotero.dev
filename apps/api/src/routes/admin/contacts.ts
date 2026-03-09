/**
 * Admin routes for contact message management.
 *
 * Routes:
 *  GET   /admin/contacts            - Paginated list with optional read filter
 *  PATCH /admin/contacts/:id/read   - Mark a contact message as read
 */

import { Hono } from 'hono';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import {
  findContactById,
  findManyContacts,
  markContactAsRead,
} from '../../repositories/contacts.repo';
import type { AppEnv } from '../../types/index';

const adminContactsRouter = new Hono<AppEnv>();

/**
 * GET /admin/contacts
 * Returns paginated contact messages, newest first.
 * Accepts optional `?read=true|false` filter.
 */
adminContactsRouter.get('/', async (c) => {
  const readParam = c.req.query('read');

  let readFilter: boolean | undefined;
  if (readParam === 'true') {
    readFilter = true;
  } else if (readParam === 'false') {
    readFilter = false;
  } else if (readParam !== undefined) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Invalid value for "read" — expected "true" or "false"'
    );
  }

  const result = await findManyContacts({
    read: readFilter,
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
  });

  return paginatedResponse(c, result.data, result.meta);
});

/**
 * PATCH /admin/contacts/:id/read
 * Marks a contact message as read by setting read_at = now().
 */
adminContactsRouter.patch('/:id/read', async (c) => {
  const id = Number(c.req.param('id'));

  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid contact ID');
  }

  const contact = await findContactById(id);
  if (!contact) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Contact not found');
  }

  if (contact.readAt !== null) {
    // Already read — return current state (idempotent)
    return successResponse(c, contact);
  }

  const updated = await markContactAsRead(id);
  return successResponse(c, updated);
});

export { adminContactsRouter };
