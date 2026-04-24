import { describe, expect, it } from 'vitest';
import {
  canonicalizeSuggestedTagNames,
  canonicalizeTagName,
  inferTagCategoryFromCatalog,
  type PersistedTagForNormalization,
} from './aiTagNormalizer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tag(name: string, slug: string): PersistedTagForNormalization {
  return { name, slug };
}

// ── canonicalizeTagName ───────────────────────────────────────────────────────

describe('canonicalizeTagName', () => {
  describe('1. Persisted tag resolution (highest priority)', () => {
    it('resolves by exact name (case-insensitive)', () => {
      const tags = [tag('TypeScript', 'typescript')];
      expect(canonicalizeTagName('typescript', tags)).toBe('TypeScript');
      expect(canonicalizeTagName('TYPESCRIPT', tags)).toBe('TypeScript');
    });

    it('resolves by slug', () => {
      const tags = [tag('React Native', 'react-native')];
      // AI emits "react native" — slug matches "react-native"
      expect(canonicalizeTagName('react native', tags)).toBe('React Native');
    });

    it('resolves by slug key (strips separators)', () => {
      const tags = [tag('Node.js', 'nodejs')];
      expect(canonicalizeTagName('Node.js', tags)).toBe('Node.js');
      expect(canonicalizeTagName('nodejs', tags)).toBe('Node.js');
    });

    it('persisted tag wins over ICON_CATALOG for same canonical', () => {
      // Custom admin name takes precedence over any catalog entry
      const tags = [tag('Postgres (custom)', 'postgres-custom')];
      expect(canonicalizeTagName('postgres-custom', tags)).toBe('Postgres (custom)');
    });
  });

  describe('2. ICON_CATALOG resolution', () => {
    it('resolves React from catalog', () => {
      expect(canonicalizeTagName('react')).toBe('React');
    });

    it('resolves TypeScript canonical capitalization from catalog', () => {
      expect(canonicalizeTagName('typescript')).toBe('TypeScript');
    });

    it('resolves Bun from catalog', () => {
      // Bun should be in the ICON_CATALOG if iconResolver has it
      const result = canonicalizeTagName('bun');
      // Either exact match or conservative fallback — should not emit empty
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('3. Explicit override map', () => {
    it('resolves JWT', () => {
      expect(canonicalizeTagName('jwt')).toBe('JWT');
      expect(canonicalizeTagName('JWT')).toBe('JWT');
    });

    it('resolves AWS', () => {
      expect(canonicalizeTagName('aws')).toBe('AWS');
    });

    it('resolves GraphQL', () => {
      expect(canonicalizeTagName('graphql')).toBe('GraphQL');
      expect(canonicalizeTagName('GraphQL')).toBe('GraphQL');
    });

    it('resolves gRPC', () => {
      expect(canonicalizeTagName('grpc')).toBe('gRPC');
    });

    it('resolves Node.js variants', () => {
      expect(canonicalizeTagName('nodejs')).toBe('Node.js');
      expect(canonicalizeTagName('node.js')).toBe('Node.js');
      expect(canonicalizeTagName('Node.js')).toBe('Node.js');
    });

    it('resolves Next.js variants', () => {
      expect(canonicalizeTagName('nextjs')).toBe('Next.js');
      expect(canonicalizeTagName('next.js')).toBe('Next.js');
    });

    it('resolves NestJS', () => {
      expect(canonicalizeTagName('nestjs')).toBe('NestJS');
    });

    it('resolves PostgreSQL aliases', () => {
      expect(canonicalizeTagName('postgres')).toBe('PostgreSQL');
      expect(canonicalizeTagName('postgresql')).toBe('PostgreSQL');
    });

    it('resolves OAuth 2.0 aliases', () => {
      expect(canonicalizeTagName('oauth2')).toBe('OAuth 2.0');
      expect(canonicalizeTagName('oauth')).toBe('OAuth');
    });

    it('resolves CI/CD alias', () => {
      expect(canonicalizeTagName('cicd')).toBe('CI/CD');
    });

    it('resolves BullMQ', () => {
      expect(canonicalizeTagName('bullmq')).toBe('BullMQ');
    });

    it('resolves WebSocket', () => {
      expect(canonicalizeTagName('websocket')).toBe('WebSocket');
    });

    it('resolves iOS', () => {
      expect(canonicalizeTagName('ios')).toBe('iOS');
    });

    it('resolves macOS', () => {
      expect(canonicalizeTagName('macos')).toBe('macOS');
    });

    it('resolves tailwind aliases to Tailwind CSS', () => {
      expect(canonicalizeTagName('tailwind')).toBe('Tailwind CSS');
      expect(canonicalizeTagName('tailwindcss')).toBe('Tailwind CSS');
    });
  });

  describe('4. Conservative fallback', () => {
    it('preserves unknown mixed-case names (gRPC-like pattern)', () => {
      // Has internal uppercase — preserve as-is
      expect(canonicalizeTagName('OpenFGA')).toBe('OpenFGA');
    });

    it('title-cases all-lowercase single word', () => {
      expect(canonicalizeTagName('queue')).toBe('Queue');
    });

    it('title-cases all-lowercase multi-word', () => {
      expect(canonicalizeTagName('event driven architecture')).toBe('Event Driven Architecture');
    });

    it('preserves already-uppercase short acronym', () => {
      // Unknown all-uppercase word — preserve
      expect(canonicalizeTagName('MTLS')).toBe('MTLS');
    });

    it('trims leading/trailing whitespace', () => {
      expect(canonicalizeTagName('  typescript  ')).toBe('TypeScript');
    });

    it('returns empty string for blank input', () => {
      expect(canonicalizeTagName('')).toBe('');
      expect(canonicalizeTagName('   ')).toBe('');
    });
  });
});

// ── canonicalizeSuggestedTagNames ─────────────────────────────────────────────

describe('canonicalizeSuggestedTagNames', () => {
  it('normalizes a list without persisted tags', () => {
    const result = canonicalizeSuggestedTagNames(['jwt', 'graphql', 'nodejs']);
    expect(result).toContain('JWT');
    expect(result).toContain('GraphQL');
    expect(result).toContain('Node.js');
  });

  it('deduplicates by slug — same canonical emitted twice', () => {
    const result = canonicalizeSuggestedTagNames(['postgres', 'postgresql', 'PostgreSQL']);
    // All three resolve to 'PostgreSQL'; after slug dedup only one should remain
    const postgresEntries = result.filter((n) => n === 'PostgreSQL');
    expect(postgresEntries).toHaveLength(1);
  });

  it('deduplicates equivalent unknown names that only differ by diacritics', () => {
    const result = canonicalizeSuggestedTagNames([
      'Arquitetura Assíncrona',
      'Arquitetura Assincrona',
    ]);

    expect(result).toEqual(['Arquitetura Assíncrona']);
  });

  it('deduplicates variants with different casing', () => {
    const result = canonicalizeSuggestedTagNames(['JWT', 'jwt']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('JWT');
  });

  it('filters out empty/blank items silently', () => {
    const result = canonicalizeSuggestedTagNames(['', '  ', 'jwt']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('JWT');
  });

  it('returns empty array for empty input', () => {
    expect(canonicalizeSuggestedTagNames([])).toEqual([]);
  });

  it('uses persisted tags for resolution when provided', () => {
    const tags = [tag('TypeScript', 'typescript')];
    const result = canonicalizeSuggestedTagNames(['typescript', 'graphql'], tags);
    expect(result[0]).toBe('TypeScript');
    expect(result[1]).toBe('GraphQL');
  });

  it('preserves order of first occurrence after deduplication', () => {
    const result = canonicalizeSuggestedTagNames(['Node.js', 'nodejs', 'JWT']);
    // Node.js first, JWT second
    expect(result[0]).toBe('Node.js');
    expect(result[1]).toBe('JWT');
  });
});

// ── inferTagCategoryFromCatalog ───────────────────────────────────────────────

describe('inferTagCategoryFromCatalog', () => {
  it('returns the correct category for a well-known catalog entry', () => {
    expect(inferTagCategoryFromCatalog('TypeScript')).toBe('language');
    expect(inferTagCategoryFromCatalog('React')).toBe('framework');
    expect(inferTagCategoryFromCatalog('Docker')).toBe('infra');
    expect(inferTagCategoryFromCatalog('PostgreSQL')).toBe('db');
    expect(inferTagCategoryFromCatalog('AWS')).toBe('cloud');
    expect(inferTagCategoryFromCatalog('GitHub Actions')).toBe('tool');
  });

  it('resolves via alias — "postgres" maps to the PostgreSQL catalog entry (db)', () => {
    expect(inferTagCategoryFromCatalog('postgres')).toBe('db');
  });

  it('resolves via alias with different casing', () => {
    expect(inferTagCategoryFromCatalog('typescript')).toBe('language');
    expect(inferTagCategoryFromCatalog('REACT')).toBe('framework');
  });

  it('returns "other" for an unknown name with no catalog match', () => {
    expect(inferTagCategoryFromCatalog('SomeObscureFramework2099')).toBe('other');
  });

  it('returns "other" for an empty string', () => {
    expect(inferTagCategoryFromCatalog('')).toBe('other');
  });

  it('resolves via alias with diacritics stripped by normalizeTagName', () => {
    // "nodejs" alias of Node.js → category "tool"
    expect(inferTagCategoryFromCatalog('nodejs')).toBe('tool');
  });
});
