/**
 * Revalidation utility for admin mutations.
 *
 * Wraps `revalidatePublicTags` so that background cache invalidation failures
 * are logged with structured context instead of silently lost via `.catch(console.error)`.
 *
 * Usage:
 *   safeRevalidate(postMutationTags());   // fire-and-forget
 *   await safeRevalidate(tagMutationTags());  // awaited when ordering matters
 */

import { revalidatePublicTags } from '@/lib/actions/revalidate-tags';
import { logClientError } from '@/lib/client-logger';

/**
 * Fire-and-forget cache revalidation with structured error logging.
 * Never throws — failures are logged but do not propagate to UI.
 */
export function safeRevalidate(tags: string[]): void {
  revalidatePublicTags(tags).catch((err: unknown) => {
    logClientError('admin:revalidate', 'Failed to revalidate public cache tags', {
      tags,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Awaited variant — use where ordering matters (e.g. after a mutation
 * that requires the public cache to be warm before redirect).
 * Still never re-throws — failures are logged only.
 */
export async function safeRevalidateAsync(tags: string[]): Promise<void> {
  try {
    await revalidatePublicTags(tags);
  } catch (err: unknown) {
    logClientError('admin:revalidate', 'Failed to revalidate public cache tags', {
      tags,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
