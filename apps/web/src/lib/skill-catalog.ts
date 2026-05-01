/**
 * Frontend skill catalog — technical subset of the shared icon resolver catalog.
 *
 * Skill creation should reuse the same canonical technology metadata used by tags,
 * but only for categories accepted by the Skill domain.
 */
import type { SkillCategory } from '@portfolio/shared/constants/enums';
import {
  ICON_CATALOG,
  type IconCatalogEntry,
  normalizeTagName,
  resolveCatalogEntry,
} from '@portfolio/shared/lib/iconResolver';

export const ALL_SKILL_CATEGORIES = [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
] as const;

export type SkillCategoryValue = SkillCategory;

export const CATEGORY_LABELS: Record<SkillCategoryValue, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de Dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
};

export type PredefinedSkillSuggestion = Omit<IconCatalogEntry, 'category'> & {
  category: SkillCategoryValue;
};

function isSkillCatalogEntry(entry: IconCatalogEntry): entry is PredefinedSkillSuggestion {
  return entry.category !== 'other';
}

export const SKILL_CATALOG: readonly PredefinedSkillSuggestion[] =
  ICON_CATALOG.filter(isSkillCatalogEntry);

export function searchSuggestions(
  suggestions: readonly PredefinedSkillSuggestion[],
  query: string
): readonly PredefinedSkillSuggestion[] {
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

export function searchAllSkillSuggestions(query: string, limit = 10): PredefinedSkillSuggestion[] {
  return searchSuggestions(SKILL_CATALOG, query).slice(0, limit);
}

export function findSkillCatalogEntryByName(name: string): PredefinedSkillSuggestion | null {
  const entry = resolveCatalogEntry(name);
  return entry && isSkillCatalogEntry(entry) ? entry : null;
}
