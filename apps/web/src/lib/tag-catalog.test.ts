import { describe, expect, it } from 'vitest';
import { SUPPORTED_LUCIDE_KEYS, SUPPORTED_SI_KEYS } from '@/components/shared/TechIcon';
import {
  ALL_TAG_CATEGORIES,
  CATEGORY_LABELS,
  findCatalogEntryByName,
  getSuggestionsByCategory,
  type PredefinedTagSuggestion,
  searchAllSuggestions,
  searchSuggestions,
  TAG_CATALOG,
} from './tag-catalog';

describe('TAG_CATALOG', () => {
  // Plan §13.3.1 — All predefined items have iconKey after catalog definition
  it('every predefined suggestion has a non-empty iconKey', () => {
    const missingIcon = TAG_CATALOG.filter((s) => !s.iconKey || s.iconKey.trim() === '');
    expect(missingIcon).toHaveLength(0);
  });

  it('every iconKey uses a valid prefix (si: or lucide:)', () => {
    const invalid = TAG_CATALOG.filter(
      (s) => !s.iconKey.startsWith('si:') && !s.iconKey.startsWith('lucide:')
    );
    expect(invalid).toHaveLength(0);
  });

  // Plan §13.3.2 — No duplicates by (category, normalizedName)
  it('has no duplicate (category, name) pairs', () => {
    const seen = new Set<string>();
    const duplicates: PredefinedTagSuggestion[] = [];
    for (const s of TAG_CATALOG) {
      const key = `${s.category}:${s.name.toLowerCase()}`;
      if (seen.has(key)) {
        duplicates.push(s);
      }
      seen.add(key);
    }
    expect(duplicates).toHaveLength(0);
  });

  it('covers all 7 categories from ALL_TAG_CATEGORIES with at least one entry', () => {
    // 'other' is intentionally left without predefined suggestions (users create custom ones)
    const categoriesWithEntries = new Set(TAG_CATALOG.map((s) => s.category));
    const required = ALL_TAG_CATEGORIES.filter((c) => c !== 'other');
    for (const cat of required) {
      expect(categoriesWithEntries).toContain(cat);
    }
  });
});

describe('CATEGORY_LABELS', () => {
  it('has a label for all 7 categories', () => {
    for (const cat of ALL_TAG_CATEGORIES) {
      expect(CATEGORY_LABELS).toHaveProperty(cat);
      expect(typeof CATEGORY_LABELS[cat]).toBe('string');
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });
});

describe('getSuggestionsByCategory', () => {
  // Plan §13.1.2 — Suggestions are filtered strictly by selected category
  it('returns only suggestions matching the given category', () => {
    const result = getSuggestionsByCategory('language');
    expect(result.every((s) => s.category === 'language')).toBe(true);
  });

  it('returns an empty array for an empty category string', () => {
    expect(getSuggestionsByCategory('')).toEqual([]);
  });

  it('returns an empty array for "other" (no predefined other-category items)', () => {
    expect(getSuggestionsByCategory('other')).toHaveLength(0);
  });

  it('returns framework suggestions for framework category', () => {
    const result = getSuggestionsByCategory('framework');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.category === 'framework')).toBe(true);
  });

  it('returns cloud suggestions for cloud category', () => {
    const result = getSuggestionsByCategory('cloud');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns infra suggestions for infra category', () => {
    const result = getSuggestionsByCategory('infra');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('searchSuggestions', () => {
  const languageSuggestions = getSuggestionsByCategory('language');
  const toolSuggestions = getSuggestionsByCategory('tool');

  it('returns all suggestions when query is empty', () => {
    const result = searchSuggestions(languageSuggestions, '');
    expect(result).toHaveLength(languageSuggestions.length);
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = searchSuggestions(languageSuggestions, 'type');
    const names = result.map((s) => s.name);
    expect(names).toContain('TypeScript');
  });

  it('filters by alias within the tool category', () => {
    // Node.js has alias 'node'
    const result = searchSuggestions(toolSuggestions, 'node');
    const names = result.map((s) => s.name);
    expect(names).toContain('Node.js');
  });

  it('returns empty array when no match found', () => {
    const result = searchSuggestions(languageSuggestions, 'xyzzy-nonexistent');
    expect(result).toHaveLength(0);
  });

  it('trims leading/trailing whitespace from query', () => {
    const result = searchSuggestions(languageSuggestions, '  ts  ');
    // 'ts' matches alias for TypeScript
    const names = result.map((s) => s.name);
    expect(names).toContain('TypeScript');
  });

  it('matches separator variations in tool aliases (e.g. underscore/hyphen)', () => {
    const result = searchSuggestions(toolSuggestions, 'node_js');
    const names = result.map((s) => s.name);
    expect(names).toContain('Node.js');
  });

  it('matches tokenized query even with different spacing', () => {
    const result = searchSuggestions(toolSuggestions, 'tanstack    query');
    const names = result.map((s) => s.name);
    expect(names).toContain('TanStack Query');
  });
});

describe('TAG_CATALOG ↔ TechIcon renderer consistency', () => {
  it('every si: iconKey in the catalog has a matching entry in SUPPORTED_SI_KEYS', () => {
    const missing = TAG_CATALOG.filter((s) => {
      if (!s.iconKey.startsWith('si:')) return false;
      const componentName = s.iconKey.slice(3); // 'si:SiGit' → 'SiGit'
      return !SUPPORTED_SI_KEYS.has(componentName);
    });

    if (missing.length > 0) {
      const names = missing.map((s) => `${s.name} (${s.iconKey})`).join(', ');
      throw new Error(
        `The following TAG_CATALOG entries have si: iconKey not supported by TechIcon: ${names}. ` +
          'Add the missing icons to the SI_MAP in TechIcon.tsx.'
      );
    }

    expect(missing).toHaveLength(0);
  });

  it('every lucide: iconKey in the catalog has a matching entry in SUPPORTED_LUCIDE_KEYS', () => {
    const missing = TAG_CATALOG.filter((s) => {
      if (!s.iconKey.startsWith('lucide:')) return false;
      const componentName = s.iconKey.slice(7); // 'lucide:Shield' → 'Shield'
      return !SUPPORTED_LUCIDE_KEYS.has(componentName);
    });

    if (missing.length > 0) {
      const names = missing.map((s) => `${s.name} (${s.iconKey})`).join(', ');
      throw new Error(
        `The following TAG_CATALOG entries have lucide: iconKey not supported by TechIcon: ${names}. ` +
          'Add the missing icons to the LUCIDE_MAP in TechIcon.tsx.'
      );
    }

    expect(missing).toHaveLength(0);
  });
});

// ── searchAllSuggestions ─────────────────────────────────────────────────────

describe('searchAllSuggestions', () => {
  it('returns results across all categories for a cross-category query', () => {
    // "react" matches React (framework) but also React Native (framework)
    const results = searchAllSuggestions('react');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.name);
    expect(names).toContain('React');
  });

  it('respects the limit parameter', () => {
    const results = searchAllSuggestions('s', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns up to 10 results by default', () => {
    const results = searchAllSuggestions('s');
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('returns an empty array when no matches are found', () => {
    const results = searchAllSuggestions('zzz_no_match_xyz');
    expect(results).toHaveLength(0);
  });

  it('each returned entry has a name, category, and iconKey', () => {
    const results = searchAllSuggestions('type');
    for (const r of results) {
      expect(r.name).toBeTruthy();
      expect(r.category).toBeTruthy();
      expect(r.iconKey).toBeTruthy();
    }
  });
});

// ── findCatalogEntryByName ───────────────────────────────────────────────────

describe('findCatalogEntryByName', () => {
  it('returns the suggestion for an exact canonical name', () => {
    const entry = findCatalogEntryByName('TypeScript');
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe('TypeScript');
    expect(entry?.category).toBe('language');
  });

  it('is case-insensitive', () => {
    const entry = findCatalogEntryByName('typescript');
    expect(entry?.name).toBe('TypeScript');
  });

  it('resolves via alias — "ts" maps to TypeScript', () => {
    const entry = findCatalogEntryByName('ts');
    expect(entry?.name).toBe('TypeScript');
  });

  it('returns null for an unknown name', () => {
    expect(findCatalogEntryByName('UnknownXYZ_12345')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(findCatalogEntryByName('')).toBeNull();
  });

  it('returned entry has a non-empty iconKey', () => {
    const entry = findCatalogEntryByName('PostgreSQL');
    expect(entry?.iconKey).toBeTruthy();
  });
});
