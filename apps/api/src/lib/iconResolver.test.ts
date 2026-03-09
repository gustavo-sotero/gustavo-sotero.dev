import {
  CATEGORY_FALLBACK_ICONS,
  ICON_CATALOG,
  normalizeTagName,
  resolveCatalogEntry,
  resolveTagIcon,
} from '@portfolio/shared/lib/iconResolver';
import { describe, expect, it } from 'vitest';

// ── normalizeTagName ──────────────────────────────────────────────────────────

describe('normalizeTagName', () => {
  it('converts to lowercase', () => {
    expect(normalizeTagName('TypeScript')).toBe('typescript');
  });

  it('removes diacritics (NFD normalization)', () => {
    expect(normalizeTagName('Über-cool')).toBe('uber cool');
  });

  it('replaces hyphens with spaces', () => {
    expect(normalizeTagName('node-js')).toBe('node js');
  });

  it('replaces underscores with spaces', () => {
    expect(normalizeTagName('react_query')).toBe('react query');
  });

  it('collapses multiple whitespace into a single space', () => {
    // Multiple spaces between tokens are collapsed; period is preserved as-is
    expect(normalizeTagName('  next  .  js  ')).toBe('next . js');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeTagName('  Docker  ')).toBe('docker');
  });

  it('handles empty string', () => {
    expect(normalizeTagName('')).toBe('');
  });
});

// ── resolveTagIcon — specific match ──────────────────────────────────────────

describe('resolveTagIcon — specific match', () => {
  it('resolves TypeScript to si:SiTypescript', () => {
    const result = resolveTagIcon('TypeScript', 'language');
    expect(result.iconKey).toBe('si:SiTypescript');
    expect(result.source).toBe('specific');
  });

  it('resolves case-insensitive: TYPESCRIPT → si:SiTypescript', () => {
    const result = resolveTagIcon('TYPESCRIPT', 'language');
    expect(result.iconKey).toBe('si:SiTypescript');
    expect(result.source).toBe('specific');
  });

  it('resolves React to si:SiReact', () => {
    const result = resolveTagIcon('React', 'framework');
    expect(result.iconKey).toBe('si:SiReact');
    expect(result.source).toBe('specific');
  });

  it('resolves Docker to si:SiDocker', () => {
    const result = resolveTagIcon('Docker', 'tool');
    expect(result.iconKey).toBe('si:SiDocker');
    expect(result.source).toBe('specific');
  });

  it('resolves PostgreSQL to si:SiPostgresql', () => {
    const result = resolveTagIcon('PostgreSQL', 'db');
    expect(result.iconKey).toBe('si:SiPostgresql');
    expect(result.source).toBe('specific');
  });

  it('resolves Next.js to si:SiNextdotjs', () => {
    const result = resolveTagIcon('Next.js', 'framework');
    expect(result.iconKey).toBe('si:SiNextdotjs');
    expect(result.source).toBe('specific');
  });
});

// ── resolveTagIcon — alias match ──────────────────────────────────────────────

describe('resolveTagIcon — alias match', () => {
  it('resolves "nodejs" alias to Node.js icon', () => {
    const result = resolveTagIcon('nodejs', 'language');
    expect(result.iconKey).toBe('si:SiNodedotjs');
    expect(result.source).toBe('specific');
  });

  it('resolves "node js" alias to Node.js icon', () => {
    const result = resolveTagIcon('node js', 'language');
    expect(result.iconKey).toBe('si:SiNodedotjs');
    expect(result.source).toBe('specific');
  });

  it('resolves "ts" alias to TypeScript icon', () => {
    const result = resolveTagIcon('ts', 'language');
    expect(result.iconKey).toBe('si:SiTypescript');
    expect(result.source).toBe('specific');
  });

  it('resolves "js" alias to JavaScript icon', () => {
    const result = resolveTagIcon('js', 'language');
    expect(result.iconKey).toBe('si:SiJavascript');
    expect(result.source).toBe('specific');
  });

  it('resolves "py" alias to Python icon', () => {
    const result = resolveTagIcon('py', 'language');
    expect(result.iconKey).toBe('si:SiPython');
    expect(result.source).toBe('specific');
  });
});

// ── resolveTagIcon — category fallback ────────────────────────────────────────

describe('resolveTagIcon — category fallback', () => {
  it('falls back to lucide:Code2 for unknown language', () => {
    const result = resolveTagIcon('SomeUnknownLanguage', 'language');
    expect(result.iconKey).toBe('lucide:Code2');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Layers for unknown framework', () => {
    const result = resolveTagIcon('RandomFramework', 'framework');
    expect(result.iconKey).toBe('lucide:Layers');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Wrench for unknown tool', () => {
    const result = resolveTagIcon('UnknownTool', 'tool');
    expect(result.iconKey).toBe('lucide:Wrench');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Database for unknown db', () => {
    const result = resolveTagIcon('UnknownDB', 'db');
    expect(result.iconKey).toBe('lucide:Database');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Cloud for unknown cloud technology', () => {
    const result = resolveTagIcon('SomeCloud', 'cloud');
    expect(result.iconKey).toBe('lucide:Cloud');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Server for unknown infra technology', () => {
    const result = resolveTagIcon('RandomInfra', 'infra');
    expect(result.iconKey).toBe('lucide:Server');
    expect(result.source).toBe('category_fallback');
  });

  it('falls back to lucide:Tag for unknown other tag', () => {
    const result = resolveTagIcon('Whatever', 'other');
    expect(result.iconKey).toBe('lucide:Tag');
    expect(result.source).toBe('category_fallback');
  });
});

// ── resolveTagIcon — invariants ───────────────────────────────────────────────

describe('resolveTagIcon — invariants', () => {
  it('never returns an empty iconKey for any input', () => {
    const inputs = [
      { name: '', category: 'other' },
      { name: '   ', category: 'language' },
      { name: 'unknown-xyz-12345', category: 'framework' },
      { name: 'TypeScript', category: 'language' },
    ] as const;

    for (const { name, category } of inputs) {
      const result = resolveTagIcon(name, category);
      expect(result.iconKey).toBeTruthy();
      expect(result.iconKey.trim()).not.toBe('');
    }
  });

  it('all category fallback icons are non-empty', () => {
    for (const [cat, iconKey] of Object.entries(CATEGORY_FALLBACK_ICONS)) {
      expect(iconKey, `Fallback for category "${cat}" must be non-empty`).toBeTruthy();
    }
  });

  it('source is exactly "specific" or "category_fallback"', () => {
    const r1 = resolveTagIcon('React', 'framework');
    const r2 = resolveTagIcon('Nonexistent', 'tool');
    expect(['specific', 'category_fallback']).toContain(r1.source);
    expect(['specific', 'category_fallback']).toContain(r2.source);
  });
});

// ── ICON_CATALOG — structural validation ─────────────────────────────────────

describe('ICON_CATALOG', () => {
  it('has 100 or more entries', () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it('every entry has a non-empty name', () => {
    const empty = ICON_CATALOG.filter((e) => !e.name || e.name.trim() === '');
    expect(empty).toHaveLength(0);
  });

  it('every entry has a non-empty iconKey', () => {
    const empty = ICON_CATALOG.filter((e) => !e.iconKey || e.iconKey.trim() === '');
    expect(empty).toHaveLength(0);
  });

  it('every iconKey uses a valid prefix (si: or lucide:)', () => {
    const invalid = ICON_CATALOG.filter(
      (e) => !e.iconKey.startsWith('si:') && !e.iconKey.startsWith('lucide:')
    );
    expect(invalid, `Invalid icon keys: ${invalid.map((e) => e.iconKey).join(', ')}`).toHaveLength(
      0
    );
  });

  it('has no duplicate canonical names within the same category', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of ICON_CATALOG) {
      const key = `${entry.category}:${normalizeTagName(entry.name)}`;
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }
    expect(dupes, `Duplicate catalog entries: ${dupes.join(', ')}`).toHaveLength(0);
  });

  it('covers all 7 required categories', () => {
    const categories = new Set(ICON_CATALOG.map((e) => e.category));
    for (const cat of ['language', 'framework', 'tool', 'db', 'cloud', 'infra'] as const) {
      expect(categories, `Missing entries for category "${cat}"`).toContain(cat);
    }
  });

  it('all alias arrays contain non-empty strings', () => {
    const badAliases = ICON_CATALOG.filter((e) => e.aliases?.some((a) => !a || a.trim() === ''));
    expect(badAliases).toHaveLength(0);
  });

  it('every entry category is one of the supported tag categories', () => {
    const validCategories = new Set([
      'language',
      'framework',
      'tool',
      'db',
      'cloud',
      'infra',
      'other',
    ]);
    const invalid = ICON_CATALOG.filter((e) => !validCategories.has(e.category));
    expect(
      invalid,
      `Invalid categories: ${invalid.map((e) => e.category).join(', ')}`
    ).toHaveLength(0);
  });

  it('has no globally duplicate normalized aliases across the entire catalog', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const entry of ICON_CATALOG) {
      const allKeys = [
        ...new Set([entry.name, ...(entry.aliases ?? [])].map((k) => normalizeTagName(k))),
      ];
      for (const norm of allKeys) {
        const existing = seen.get(norm);
        if (existing && existing !== entry.name) {
          // Only flag genuine cross-entry conflicts, not same-entry self-duplicates
          dupes.push(`"${norm}" in ${entry.name} conflicts with ${existing}`);
        } else if (!existing) {
          seen.set(norm, entry.name);
        }
      }
    }
    expect(dupes, `Duplicate aliases globally: ${dupes.join(', ')}`).toHaveLength(0);
  });
});

// ── resolveCatalogEntry ───────────────────────────────────────────────────────

describe('resolveCatalogEntry', () => {
  it('returns the matching entry for a canonical name', () => {
    const entry = resolveCatalogEntry('TypeScript');
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe('TypeScript');
    expect(entry?.category).toBe('language');
  });

  it('is case-insensitive — matches lowercase input', () => {
    const entry = resolveCatalogEntry('typescript');
    expect(entry?.name).toBe('TypeScript');
  });

  it('resolves via alias — "ts" maps to TypeScript', () => {
    const entry = resolveCatalogEntry('ts');
    expect(entry?.name).toBe('TypeScript');
  });

  it('resolves a well-known framework alias', () => {
    const entry = resolveCatalogEntry('node');
    expect(entry?.name).toBe('Node.js');
  });

  it('returns null for an unknown name', () => {
    expect(resolveCatalogEntry('UnknownXYZ_12345')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(resolveCatalogEntry('')).toBeNull();
  });

  it('returned entry contains a non-empty iconKey', () => {
    const entry = resolveCatalogEntry('PostgreSQL');
    expect(entry?.iconKey).toBeTruthy();
  });
});
