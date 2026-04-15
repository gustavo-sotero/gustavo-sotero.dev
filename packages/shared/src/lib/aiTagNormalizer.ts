/**
 * AI Tag Normalizer — canonical display-casing for AI-suggested tag names.
 *
 * Resolves the best display name for a tag suggested by the AI, using the
 * following precedence (highest priority first):
 *
 *  1. Persisted tags from the admin catalog (exact name or slug match)
 *  2. ICON_CATALOG canonical names (name or aliases match)
 *  3. Explicit override map for high-confidence acronyms/forms
 *  4. Conservative fallback formatting (preserve original if already mixed-case,
 *     apply minimal title-case only for all-lowercase words)
 *
 * The normalizer is intentionally conservative: it never mangles unknown
 * mixed-case names like gRPC, GraphQL, iOS, or OpenAPI.
 *
 * Usage (backend — pass persisted tags for highest-quality resolution):
 *   const canonical = canonicalizeTagName(aiSuggestedName, persistedTags);
 *
 * Usage (deduplication of a list):
 *   const normalized = canonicalizeSuggestedTagNames(rawNames, persistedTags);
 */

import { ICON_CATALOG } from './iconResolver';
import { generateSlug } from './slug';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal shape of a persisted tag record needed for resolution. */
export interface PersistedTagForNormalization {
  name: string;
  slug: string;
}

// ── Explicit override map ─────────────────────────────────────────────────────
// Small, high-confidence map for acronyms/forms the AI reliably emits.
// Keyed by normalized lookup key (lowercase, no-separators).

const EXPLICIT_OVERRIDES: Readonly<Record<string, string>> = {
  jwt: 'JWT',
  oauth: 'OAuth',
  oauth2: 'OAuth 2.0',
  'oauth 2': 'OAuth 2.0',
  'oauth 20': 'OAuth 2.0',
  rbac: 'RBAC',
  api: 'API',
  http: 'HTTP',
  https: 'HTTPS',
  s3: 'S3',
  sqs: 'SQS',
  sns: 'SNS',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  cdn: 'CDN',
  dns: 'DNS',
  ssl: 'SSL',
  tls: 'TLS',
  orm: 'ORM',
  sql: 'SQL',
  nosql: 'NoSQL',
  grpc: 'gRPC',
  graphql: 'GraphQL',
  openapi: 'OpenAPI',
  openid: 'OpenID',
  sse: 'SSE',
  csrf: 'CSRF',
  xss: 'XSS',
  owasp: 'OWASP',
  lgpd: 'LGPD',
  gdpr: 'GDPR',
  aws: 'AWS',
  gcp: 'GCP',
  iam: 'IAM',
  ec2: 'EC2',
  rds: 'RDS',
  vpc: 'VPC',
  cqrs: 'CQRS',
  ddd: 'DDD',
  cli: 'CLI',
  ide: 'IDE',
  sdk: 'SDK',
  ui: 'UI',
  ux: 'UX',
  sso: 'SSO',
  saml: 'SAML',
  jwt2: 'JWT',
  ttl: 'TTL',
  cpu: 'CPU',
  ram: 'RAM',
  ios: 'iOS',
  macos: 'macOS',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  nestjs: 'NestJS',
  reactnative: 'React Native',
  trpc: 'tRPC',
  tailwindcss: 'Tailwind CSS',
  tailwind: 'Tailwind CSS',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  bullmq: 'BullMQ',
  websocket: 'WebSocket',
  webassembly: 'WebAssembly',
  wasm: 'WebAssembly',
};

// ── Lookup key normalization ──────────────────────────────────────────────────

/**
 * Normalize a tag name to a consistent lookup key.
 * Folds case, trims, collapses whitespace, removes most punctuation but
 * preserves a small set of meaningful separators (/ . -) for acronym lookup.
 */
function toLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse internal whitespace
    .replace(/[^a-z0-9./ -]/g, '') // remove non-alphanumeric except . / space and -
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Alt lookup key that strips all separators — useful for matching
 * "Node.js" against "nodejs", "React Native" against "reactnative".
 */
function toSlugKey(name: string): string {
  return generateSlug(name);
}

// ── Catalog lookup build ──────────────────────────────────────────────────────

type CatalogLookup = Map<string, string>;

let _catalogLookupCache: CatalogLookup | null = null;

function buildCatalogLookup(): CatalogLookup {
  if (_catalogLookupCache) return _catalogLookupCache;

  const lookup = new Map<string, string>();

  for (const entry of ICON_CATALOG) {
    const canonicalName = entry.name;
    // Primary: by exact (lowercased) name
    lookup.set(entry.name.toLowerCase(), canonicalName);
    // By slug key
    const slugKey = toSlugKey(entry.name);
    if (slugKey) lookup.set(slugKey, canonicalName);
    // By lookup key (handles punctuation variations)
    const lookupKey = toLookupKey(entry.name);
    if (lookupKey) lookup.set(lookupKey, canonicalName);
    // All aliases
    for (const alias of entry.aliases ?? []) {
      lookup.set(alias.toLowerCase(), canonicalName);
      const aliasLookup = toLookupKey(alias);
      if (aliasLookup) lookup.set(aliasLookup, canonicalName);
      const aliasSlug = toSlugKey(alias);
      if (aliasSlug) lookup.set(aliasSlug, canonicalName);
    }
  }

  _catalogLookupCache = lookup;
  return lookup;
}

/** Build a lookup map from persisted tags for O(1) resolution. */
function buildPersistedTagLookup(tags: PersistedTagForNormalization[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const tag of tags) {
    lookup.set(tag.name.toLowerCase(), tag.name);
    const slugKey = toSlugKey(tag.name);
    if (slugKey) lookup.set(slugKey, tag.name);
    const lookupKey = toLookupKey(tag.name);
    if (lookupKey) lookup.set(lookupKey, tag.name);
    // Also register by own slug
    lookup.set(tag.slug.toLowerCase(), tag.name);
  }
  return lookup;
}

// ── Conservative fallback formatting ─────────────────────────────────────────

/**
 * Conservative fallback for unknown tag names.
 *
 * Rules (based on plan section 12.5):
 *  1. If the input is already mixed-case (has internal uppercase), preserve
 *     the trimmed original — avoids corrupting gRPC, GraphQL, iOS, etc.
 *  2. If the input is all-lowercase words, apply minimal title-case per word.
 *  3. Never blindly uppercase short values.
 */
function conservativeFallback(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Already has internal uppercase — preserve as-is
  const hasInternalUppercase = /[a-z][A-Z]|[A-Z][a-z]{2}/.test(trimmed);
  if (hasInternalUppercase) return trimmed;

  // If the whole string is uppercase (e.g. "JWT", "API") — preserve
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return trimmed;

  // All lowercase words → apply minimal title-case per word
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Mixed/other — preserve trimmed original
  return trimmed;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical display name for a single AI-suggested tag name.
 *
 * @param rawName     - Tag name as returned by the AI
 * @param persistedTags - All tags from the catalog (for highest-quality matching)
 * @returns Canonical display name
 */
export function canonicalizeTagName(
  rawName: string,
  persistedTags: PersistedTagForNormalization[] = []
): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;

  const lookupKey = toLookupKey(trimmed);
  const slugKey = toSlugKey(trimmed);

  // 1. Persisted tags — highest priority
  const persistedLookup = buildPersistedTagLookup(persistedTags);
  const fromPersisted =
    persistedLookup.get(trimmed.toLowerCase()) ??
    persistedLookup.get(lookupKey) ??
    persistedLookup.get(slugKey);
  if (fromPersisted) return fromPersisted;

  // 2. ICON_CATALOG canonical names
  const catalogLookup = buildCatalogLookup();
  const fromCatalog =
    catalogLookup.get(trimmed.toLowerCase()) ??
    catalogLookup.get(lookupKey) ??
    catalogLookup.get(slugKey);
  if (fromCatalog) return fromCatalog;

  // 3. Explicit override map
  const fromOverride =
    EXPLICIT_OVERRIDES[trimmed.toLowerCase()] ??
    EXPLICIT_OVERRIDES[lookupKey] ??
    EXPLICIT_OVERRIDES[slugKey];
  if (fromOverride) return fromOverride;

  // 4. Conservative fallback
  return conservativeFallback(trimmed);
}

/**
 * Canonicalize a list of AI-suggested tag names.
 * Deduplicates by slug after normalization, preserving first canonical occurrence.
 *
 * @param rawNames    - Tag names as returned by the AI
 * @param persistedTags - All tags from the catalog
 * @returns Deduplicated list of canonical display names
 */
export function canonicalizeSuggestedTagNames(
  rawNames: string[],
  persistedTags: PersistedTagForNormalization[] = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawName of rawNames) {
    const canonical = canonicalizeTagName(rawName, persistedTags);
    if (!canonical) continue;
    const dedupeKey = generateSlug(canonical);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(canonical);
  }

  return result;
}
