'use server';

import { revalidateTag } from 'next/cache';
import { logServerError } from '@/lib/server-logger';

const MAX_TAGS = 20;

/**
 * Server Action — revalidates Next.js cache entries by tag.
 *
 * Called from client-side admin mutation hooks (`onSuccess`).
 * Running server-side means `revalidateTag` is always available,
 * and no secret needs to be exposed in the browser bundle.
 *
 * Failure is **best-effort**: any error is logged and swallowed so
 * the admin UX is never blocked by a cache invalidation failure.
 *
 * @param tags - Array of cache tags to revalidate (max 20).
 */
export async function revalidatePublicTags(tags: string[]): Promise<void> {
  if (!Array.isArray(tags) || tags.length === 0) return;

  const valid = tags
    .slice(0, MAX_TAGS)
    .filter((t) => typeof t === 'string' && t.startsWith('public:') && t.length <= 100);

  if (valid.length === 0) return;

  try {
    for (const tag of valid) {
      revalidateTag(tag, 'max');
    }
  } catch (err) {
    // best-effort — do not throw so admin mutations succeed even if revalidation fails
    logServerError('revalidate-tags', 'Failed to revalidate tags', {
      tags: valid,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
