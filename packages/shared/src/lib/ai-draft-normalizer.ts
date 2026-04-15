/**
 * Shared normalization utilities used by both the API service and the worker
 * job when processing AI-generated draft content.
 */

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
 */
export function buildFallbackImagePrompt(title: string): string {
  return `Minimalist dark background illustration representing "${title}", flat design, tech aesthetic, no text, square format`;
}
