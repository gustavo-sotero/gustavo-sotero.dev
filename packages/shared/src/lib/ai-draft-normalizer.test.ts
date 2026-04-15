import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPostUrl,
  buildFallbackImagePrompt,
  normalizeLinkedInPost,
} from './ai-draft-normalizer';
import { AiGenerationError } from './ai-error';

// ── buildCanonicalPostUrl ─────────────────────────────────────────────────────

describe('buildCanonicalPostUrl', () => {
  it('builds the expected canonical URL from a slug', () => {
    const url = buildCanonicalPostUrl('filas-vs-rpc');
    expect(url).toBe('https://gustavo-sotero.dev/blog/filas-vs-rpc');
  });

  it('does not produce a double slash', () => {
    const url = buildCanonicalPostUrl('meu-post');
    expect(url).not.toContain('//blog');
  });
});

// ── buildFallbackImagePrompt ──────────────────────────────────────────────────

describe('buildFallbackImagePrompt', () => {
  it('returns a PT-BR prompt that includes the post title and all editorial constraints', () => {
    const prompt = buildFallbackImagePrompt('TypeScript na Prática');
    expect(prompt).toContain('TypeScript na Prática');
    expect(prompt).toMatch(/simples/i);
    expect(prompt).toMatch(/minimalista/i);
    expect(prompt).toMatch(/elegante/i);
    expect(prompt).toMatch(/1:1|4:3/);
    expect(prompt).toMatch(/thumb/i);
    expect(prompt).toMatch(/texto opcional/i);
  });
});

// ── normalizeLinkedInPost ─────────────────────────────────────────────────────

describe('normalizeLinkedInPost', () => {
  const SLUG = 'filas-vs-rpc';
  const CANONICAL_URL = 'https://gustavo-sotero.dev/blog/filas-vs-rpc';

  it('replaces {{POST_URL}} placeholder with the canonical URL', () => {
    const raw = 'Novo post sobre filas. Leia em {{POST_URL}}\n\n#BullMQ #Redis #Nodejs';
    const result = normalizeLinkedInPost(raw, SLUG, []);
    expect(result).toContain(CANONICAL_URL);
    expect(result).not.toContain('{{POST_URL}}');
  });

  it('appends the canonical URL when the placeholder is absent', () => {
    const raw = 'Novo post sobre filas.\n\n#BullMQ #Redis #Nodejs';
    const result = normalizeLinkedInPost(raw, SLUG, []);
    expect(result).toContain(CANONICAL_URL);
  });

  it('does not duplicate the canonical URL if already present', () => {
    const raw = `Novo post. ${CANONICAL_URL}\n\n#BullMQ #Redis #Nodejs`;
    const result = normalizeLinkedInPost(raw, SLUG, []);
    expect(result.split(CANONICAL_URL)).toHaveLength(2); // exactly 1 occurrence
  });

  it('replaces any generated absolute URL with exactly one canonical URL', () => {
    const raw =
      'Novo post sobre filas. Leia em https://inventado.dev/post-qualquer e também em {{POST_URL}}\n\n#BullMQ #Redis #Nodejs';
    const result = normalizeLinkedInPost(raw, SLUG, []);
    expect(result).toContain(CANONICAL_URL);
    expect(result).not.toContain('https://inventado.dev/post-qualquer');
    expect(result.split(CANONICAL_URL)).toHaveLength(2);
  });

  it('deduplicates existing hashtags (case-insensitive)', () => {
    const raw = `Post sobre filas. ${CANONICAL_URL}\n\n#BullMQ #bullmq #Redis`;
    const result = normalizeLinkedInPost(raw, SLUG, []);
    const hashtags = result.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    const lower = hashtags.map((h) => h.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('supplements hashtags from suggestedTagNames when below minimum (3)', () => {
    const raw = `Post sobre filas. {{POST_URL}}\n\n#BullMQ`;
    const result = normalizeLinkedInPost(raw, SLUG, ['Redis', 'TypeScript', 'Node.js']);
    const hashtags = result.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    expect(hashtags.length).toBeGreaterThanOrEqual(3);
  });

  it('trims hashtags to the maximum allowed count (5)', () => {
    const raw = `Post. {{POST_URL}}\n\n#A #B #C #D #E #F #G #H`;
    const result = normalizeLinkedInPost(raw, SLUG, []);
    const hashtags = result.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    expect(hashtags.length).toBeLessThanOrEqual(5);
  });

  it('re-appends all hashtags at the end of the post', () => {
    const raw = `Texto com #BullMQ no meio. {{POST_URL}}\n\n#Redis #TypeScript`;
    const result = normalizeLinkedInPost(raw, SLUG, []);
    // All hashtags should be in the last paragraph
    const lines = result.split('\n');
    const lastLine = lines.at(-1) ?? '';
    expect(lastLine).toMatch(/^#/);
  });

  it('throws validation when linkedinPost is blank instead of fabricating copy', () => {
    expect(() => normalizeLinkedInPost('   ', SLUG, ['TypeScript', 'Node.js', 'BullMQ'])).toThrow(
      AiGenerationError
    );
  });

  it('throws validation when there are no hashtags in the raw text or suggested tags', () => {
    expect(() => normalizeLinkedInPost('Novo post. {{POST_URL}}', SLUG, [])).toThrow(
      AiGenerationError
    );
  });

  it('converts tag names with separators to valid hashtags', () => {
    const raw = `Post. {{POST_URL}}`;
    const result = normalizeLinkedInPost(raw, SLUG, ['Next.js', 'CI/CD', 'Node.js']);
    expect(result).toContain('#Nextjs');
    expect(result).toContain('#CICD');
    expect(result).toContain('#Nodejs');
  });
});
