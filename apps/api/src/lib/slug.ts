/**
 * Slug generation and uniqueness enforcement utilities.
 *
 * Re-exports the canonical implementation from @portfolio/shared so the API
 * and web share exactly the same slugification logic.
 */
export { ensureUniqueSlug, generateSlug } from '@portfolio/shared';
