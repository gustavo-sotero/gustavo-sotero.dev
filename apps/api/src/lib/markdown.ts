/**
 * Full Markdown rendering pipeline for posts and projects.
 *
 * Features:
 *  - GFM (tables, task lists, strikethrough)
 *  - Syntax highlighting via Shiki (dual-theme: github-light / github-dark)
 *  - Mermaid: code blocks with lang="mermaid" → <div class="mermaid" data-content="...">
 *  - External links: target="_blank" rel="nofollow noreferrer"
 *  - HTML sanitization via rehype-sanitize (custom allowlist)
 *
 * Strategy: render at write-time (create/update) and store in `rendered_content`.
 * Public endpoints return pre-rendered HTML — no rendering cost at read time.
 */

import rehypeShiki from '@shikijs/rehype';
import type { Element, Root } from 'hast';
import type { Schema } from 'hast-util-sanitize';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type Plugin, unified } from 'unified';
import type { Parent } from 'unist';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin that converts Mermaid code blocks emitted by remark/rehype:
 *
 * <pre><code class="language-mermaid">...</code></pre>
 *
 * into:
 *
 * <div class="mermaid" data-content="...base64-encoded content..."></div>
 *
 * before sanitization, so Mermaid can be rendered safely client-side.
 */
function isElementNode(node: unknown): node is Element {
  return (
    typeof node === 'object' && node !== null && (node as { type?: unknown }).type === 'element'
  );
}

function isParentNode(node: unknown): node is Parent {
  return typeof node === 'object' && node !== null && Array.isArray((node as Parent).children);
}

function getClassNames(node: Element): string[] {
  const className = node.properties?.className;
  if (Array.isArray(className)) {
    return className.map(String);
  }
  if (typeof className === 'string') {
    return [className];
  }
  return [];
}

const rehypeMermaidPlaceholder: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!isElementNode(node)) return;
      if (node.tagName !== 'pre' || !Array.isArray(node.children) || node.children.length !== 1) {
        return;
      }

      const codeNode = node.children[0];
      if (!isElementNode(codeNode) || codeNode.tagName !== 'code') {
        return;
      }

      const classes = getClassNames(codeNode);
      if (!classes.includes('language-mermaid')) {
        return;
      }

      const textNode = Array.isArray(codeNode.children) ? codeNode.children[0] : null;
      const rawMermaid =
        textNode && typeof textNode === 'object' && textNode.type === 'text'
          ? String((textNode as { value?: unknown }).value ?? '')
          : '';
      const encoded = Buffer.from(rawMermaid, 'utf-8').toString('base64');

      const placeholder: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid'],
          'data-content': encoded,
        },
        children: [],
      };

      if (isParentNode(parent) && typeof index === 'number') {
        parent.children.splice(index, 1, placeholder);
      }
    });
  };
};

/**
 * Custom sanitization schema — extends the rehype-sanitize default schema.
 *
 * Allows:
 *  - class/style on <pre> and <code> (for Shiki output)
 *  - <div class="mermaid"> with data-content (Mermaid placeholder)
 *  - <iframe> only from YouTube / Vimeo domains
 *  - All standard safe attributes
 *
 * Blocks:
 *  - <script>, <object>, <embed>
 *  - All on* event handlers
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'div', 'span', 'iframe'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'class'],
    // <code> needs class for highlighting
    code: ['className', 'class', 'style'],
    // <pre> needs class for Shiki wrapper
    pre: ['className', 'class', 'style'],
    // <div> for Mermaid placeholder
    div: ['className', 'class', 'data-content'],
    // <span> for Shiki tokens
    span: ['class', 'style'],
    // <iframe> restricted to src on allowlisted domains
    iframe: [
      'src',
      'width',
      'height',
      'frameborder',
      'allowfullscreen',
      'allowFullScreen',
      'allow',
      'title',
    ],
    // Keep anchor tags with safe attributes
    a: ['href', 'title', 'target', 'rel'],
    // Image attributes
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Allow only http/https for iframes (no data:, javascript:)
    src: ['http', 'https'],
    href: ['http', 'https', 'mailto'],
  },
} satisfies Schema;

/**
 * Post-sanitize rehype plugin that enforces iframe domain allowlist.
 * Removes any <iframe> whose src does not start with an allowed domain.
 */
const allowedIframeDomains = [
  'https://www.youtube.com/',
  'https://www.youtube-nocookie.com/',
  'https://player.vimeo.com/',
];

const rehypeEnforceIframeAllowlist: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!isElementNode(node) || node.tagName !== 'iframe') return;
      const src = String(node.properties?.src ?? '');
      const allowed = allowedIframeDomains.some((domain) => src.startsWith(domain));
      if (!allowed && isParentNode(parent) && typeof index === 'number') {
        parent.children.splice(index, 1);
      }
    });
  };
};

function createProcessor() {
  const instance = unified();
  const rehypeShikiPlugin = rehypeShiki as unknown as Plugin<
    [{ themes: { light: string; dark: string } }]
  >;
  instance.use(remarkParse);
  instance.use(remarkGfm);
  instance.use(remarkRehype, { allowDangerousHtml: true });
  instance.use(rehypeRaw);
  instance.use(rehypeMermaidPlaceholder);
  instance.use(rehypeShikiPlugin, {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });
  instance.use(rehypeSanitize, sanitizeSchema);
  instance.use(rehypeEnforceIframeAllowlist);
  instance.use(rehypeExternalLinks, {
    target: '_blank',
    rel: ['nofollow', 'noreferrer'],
  });
  instance.use(rehypeStringify);
  return instance;
}

let processor: ReturnType<typeof createProcessor> | undefined;

async function getProcessor() {
  if (!processor) {
    processor = createProcessor();
  }
  return processor;
}

/**
 * Render Markdown content to safe HTML for posts and projects.
 *
 * Includes Shiki syntax highlighting with dual themes (light/dark via CSS
 * variables), GFM extensions, Mermaid placeholder, external link rules,
 * and thorough HTML sanitization.
 */
export async function renderMarkdown(content: string): Promise<string> {
  const processor = await getProcessor();
  const result = await processor.process(content);
  return String(result);
}
