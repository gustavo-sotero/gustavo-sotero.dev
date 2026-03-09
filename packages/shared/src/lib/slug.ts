/**
 * Slug generation and uniqueness enforcement utilities.
 * Shared between API (server-side) and web (client-side slug preview).
 */

/**
 * Convert a title string into a URL-safe slug.
 *
 * Steps:
 *  1. Normalize Unicode (NFD) to decompose accented characters
 *  2. Remove combining diacritical marks
 *  3. Lowercase
 *  4. Replace spaces and underscores with hyphens
 *  5. Remove characters that are not alphanumeric or hyphens
 *  6. Collapse consecutive hyphens into one
 *  7. Trim leading/trailing hyphens
 */
export function generateSlug(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[\s_]+/g, '-') // spaces/underscores → hyphen
    .replace(/[^a-z0-9-]/g, '') // remove invalid chars
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ''); // trim edge hyphens

  return slug.length > 0 ? slug : 'item';
}

/**
 * Ensure a slug is unique by appending a numeric suffix when collisions exist.
 *
 * @param baseSlug    - The desired slug (already generated via `generateSlug`)
 * @param checkFn     - An async function that returns `true` if the slug is taken
 * @param maxAttempts - Safety limit (default 100)
 * @returns A unique slug string
 * @throws Error if no unique slug can be found within `maxAttempts`
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  checkFn: (slug: string) => Promise<boolean>,
  maxAttempts = 100
): Promise<string> {
  if (!(await checkFn(baseSlug))) {
    return baseSlug;
  }

  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await checkFn(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to generate a unique slug for "${baseSlug}" after ${maxAttempts} attempts`
  );
}
