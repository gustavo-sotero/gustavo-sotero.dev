/**
 * Shared normalization utilities used by both the API service and the worker
 * job when processing AI-generated draft content.
 */

import { DEVELOPER_PUBLIC_PROFILE } from '../constants/developerProfile';

const DISALLOWED_INLINE_HTML_RE = /<\/?[a-z][\w:-]*(?:\s[^<>]*)?>|<!--|<!doctype\b/i;

/**
 * Normalises raw content from the AI provider:
 * - Normalises CRLF to LF and trims surrounding whitespace.
 * - Unwraps explicit ```markdown / ```md fences so that legitimate leading
 *   code fences (e.g. ```mermaid) remain intact.
 */
export function normalizeContent(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const lastLine = lines.at(-1)?.trim() ?? '';

  // Unwrap only explicit markdown wrappers so legitimate leading/trailing
  // code fences (for example ```mermaid at the start of the draft) stay intact.
  if (/^```(?:markdown|md)\s*$/i.test(firstLine) && lastLine === '```') {
    return lines.slice(1, -1).join('\n').trim();
  }

  return normalized;
}

/**
 * Returns `true` if the content contains inline HTML tags outside of code
 * fences. Code fence contents are excluded so that HTML in code examples does
 * not trigger a false positive.
 */
export function containsDisallowedInlineHtml(content: string): boolean {
  let inCodeFence = false;
  const outsideCodeFenceLines: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence) {
      outsideCodeFenceLines.push(line);
    }
  }

  return DISALLOWED_INLINE_HTML_RE.test(outsideCodeFenceLines.join('\n'));
}

/**
 * Builds a generic image-generation prompt for drafts that didn't supply one.
 * Text is in PT-BR to align with the editorial language of the blog.
 */
export function buildFallbackImagePrompt(title: string): string {
  return `Ilustração minimalista de fundo escuro representando "${title}", flat design, estética técnica, formato quadrado`;
}

/**
 * Builds the canonical public URL for a blog post.
 * Uses the developer's public website origin from the shared profile constant.
 */
export function buildCanonicalPostUrl(normalizedSlug: string): string {
  const origin = DEVELOPER_PUBLIC_PROFILE.links.website.replace(/\/$/, '');
  return `${origin}/blog/${normalizedSlug}`;
}

/** Placeholder the AI model must emit in linkedinPost instead of a real URL. */
const LINKEDIN_POST_URL_PLACEHOLDER = '{{POST_URL}}';

/** Minimum and maximum hashtag counts required in the final linkedinPost. */
const LINKEDIN_MIN_HASHTAGS = 3;
const LINKEDIN_MAX_HASHTAGS = 5;

/**
 * Converts a tag display name to a LinkedIn-safe hashtag.
 * Removes spaces, hyphens, dots, and other separators; preserves casing.
 * Examples:
 *   "Next.js"  → "#Nextjs"
 *   "CI/CD"    → "#CICD"
 *   "Node.js"  → "#Nodejs"
 *   "BullMQ"   → "#BullMQ"
 */
function tagNameToHashtag(name: string): string {
  // Remove characters invalid in a hashtag (keep alphanumeric and Unicode letters)
  const clean = name.replace(/[\s.\-/\\|,;:!?@#$%^&*()[\]{}<>'"=+`~]/g, '');
  if (!clean) return '';
  return `#${clean}`;
}

/**
 * Extracts all hashtags (words starting with #) from the end portion of
 * a LinkedIn post text. Only looks in the last paragraph-like block
 * (after the final blank line or after the last newline cluster).
 */
function extractHashtagsFromText(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ?? [];
}

/**
 * Normalises the linkedinPost field of an AI-generated draft:
 *
 * 1. Replaces {{POST_URL}} placeholder with the canonical blog post URL.
 *    If the placeholder is absent, appends the URL exactly once.
 * 2. Ensures the post ends with 3–5 relevant hashtags.
 *    - Deduplicates existing hashtags.
 *    - Supplements from suggestedTagNames when below the minimum.
 *    - Trims to the maximum allowed count.
 *
 * @param raw              Raw linkedinPost string from the AI provider.
 * @param normalizedSlug   Post slug already normalised by the application.
 * @param suggestedTagNames Tag names already canonicalized by the application.
 */
export function normalizeLinkedInPost(
  raw: string,
  normalizedSlug: string,
  suggestedTagNames: string[]
): string {
  const canonicalUrl = buildCanonicalPostUrl(normalizedSlug);

  // 1. Resolve the post URL placeholder.
  let text: string;
  if (raw.includes(LINKEDIN_POST_URL_PLACEHOLDER)) {
    text = raw.replace(LINKEDIN_POST_URL_PLACEHOLDER, canonicalUrl);
  } else if (!raw.includes(canonicalUrl)) {
    // Append URL on its own line if neither placeholder nor URL is present
    text = `${raw.trimEnd()}\n\n${canonicalUrl}`;
  } else {
    text = raw;
  }

  // 2. Extract and normalise existing hashtags.
  const existingHashtags = extractHashtagsFromText(text);
  const seenHashtags = new Set<string>();
  const deduped: string[] = [];
  for (const h of existingHashtags) {
    const key = h.toLowerCase();
    if (!seenHashtags.has(key)) {
      seenHashtags.add(key);
      deduped.push(h);
    }
  }

  // 3. Build supplemental hashtags from suggestedTagNames when below minimum.
  if (deduped.length < LINKEDIN_MIN_HASHTAGS) {
    for (const name of suggestedTagNames) {
      if (deduped.length >= LINKEDIN_MIN_HASHTAGS) break;
      const hashtag = tagNameToHashtag(name);
      if (!hashtag) continue;
      const key = hashtag.toLowerCase();
      if (!seenHashtags.has(key)) {
        seenHashtags.add(key);
        deduped.push(hashtag);
      }
    }
  }

  // 4. Trim to maximum allowed count.
  const finalHashtags = deduped.slice(0, LINKEDIN_MAX_HASHTAGS);

  // 5. Strip all existing hashtags from the text body and re-append normalised set.
  const bodyWithoutHashtags = text.replace(/#[\w\u00C0-\u024F]+/g, '').trimEnd();
  // Clean up any trailing whitespace/punctuation left after hashtag removal
  const cleanBody = bodyWithoutHashtags.replace(/\s+$/, '');

  return `${cleanBody}\n\n${finalHashtags.join(' ')}`.trim();
}
