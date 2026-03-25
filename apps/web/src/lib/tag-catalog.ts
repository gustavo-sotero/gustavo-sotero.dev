/**
 * Frontend tag catalog — wraps the shared icon resolver catalog.
 *
 * Single source of truth lives in `@portfolio/shared/lib/iconResolver`.
 * This module re-exports it with the frontend-specific type alias and
 * provides convenience helpers for the admin UI.
 */
import type { TagCategory } from '@portfolio/shared';
import {
  ICON_CATALOG,
  type IconCatalogEntry,
  normalizeTagName,
  resolveCatalogEntry,
} from '@portfolio/shared/lib/iconResolver';

// All 7 supported tag categories (mirrors shared/constants/enums.ts)
export const ALL_TAG_CATEGORIES = [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
  'other',
] as const;

export type TagCategoryValue = TagCategory;

// Human-readable labels for all 7 categories
export const CATEGORY_LABELS: Record<TagCategoryValue, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de Dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
  other: 'Outro',
};

// Badge color classes for all 7 categories
export const CATEGORY_COLORS: Record<TagCategoryValue, string> = {
  language: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  framework: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  tool: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  db: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cloud: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  infra: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

/**
 * A tag suggestion displayed in the admin create/edit form.
 * Structurally identical to `IconCatalogEntry` — re-exported as a named alias
 * so admin UI code does not couple directly to the shared resolver's internals.
 */
export type PredefinedTagSuggestion = IconCatalogEntry;

/**
 * The canonical tag catalog, sourced from the shared icon resolver.
 * Single source of truth — no duplication with the backend catalog.
 */
export const TAG_CATALOG: readonly PredefinedTagSuggestion[] = ICON_CATALOG;

/**
 * Returns all predefined suggestions for the given category.
 * Returns empty array if no category is provided.
 */
export function getSuggestionsByCategory(
  category: TagCategoryValue | ''
): PredefinedTagSuggestion[] {
  if (!category) return [];
  return TAG_CATALOG.filter((s) => s.category === category);
}

/**
 * Filters suggestions by query string, searching name and aliases.
 * If query is empty, returns all provided suggestions.
 */
export function searchSuggestions(
  suggestions: readonly PredefinedTagSuggestion[],
  query: string
): readonly PredefinedTagSuggestion[] {
  const normalizedQuery = normalizeTagName(query);
  if (!normalizedQuery) return suggestions;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  return suggestions.filter((suggestion) => {
    const normalizedTargets = [
      normalizeTagName(suggestion.name),
      ...(suggestion.aliases?.map((alias) => normalizeTagName(alias)) ?? []),
    ];

    return normalizedTargets.some((target) => {
      if (target.includes(normalizedQuery)) return true;
      return queryTokens.every((token) => target.includes(token));
    });
  });
}

/**
 * Searches ALL categories for suggestions matching the query.
 * Used by the "name-first" tag creation flow where the category is not yet known.
 * Returns up to `limit` results (default 10), ordered by catalog position.
 */
export function searchAllSuggestions(query: string, limit = 10): PredefinedTagSuggestion[] {
  return searchSuggestions(TAG_CATALOG, query).slice(0, limit);
}

/**
 * Finds a predefined catalog entry that exactly matches the given name or any alias.
 * Returns `null` when no entry matches — indicating the tag is "unmapped" and
 * requires a manual category selection.
 *
 * Uses the same normalisation as the backend resolver so both sides agree on
 * whether a tag is mapped.
 */
export function findCatalogEntryByName(name: string): PredefinedTagSuggestion | null {
  return resolveCatalogEntry(name);
}
