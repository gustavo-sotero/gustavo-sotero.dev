/**
 * Restricted Markdown rendering pipeline for user comments.
 *
 * Compared to the full editorial pipeline (`markdown.ts`), this version:
 *  - Does NOT apply Shiki syntax highlighting
 *  - Does NOT support Mermaid diagrams
 *  - Does NOT allow images
 *  - Does NOT allow iframes or embeds
 *  - Does NOT allow HTML passthroughs
 *  - Strips javascript: and data: URIs from hrefs
 *  - Applies rel="nofollow ugc noreferrer" + target="_blank" to all links
 *
 * Strategy: render at write-time (comment create) and store in `rendered_content`.
 */

import type { Schema } from 'hast-util-sanitize';
import type { Root as MdastRoot } from 'mdast';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type Plugin, unified } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that strips javascript: and data: URIs from links.
 */
const remarkStripDangerousLinks: Plugin<[], MdastRoot> = () => {
  return (tree) => {
    visit(tree, 'link', (node) => {
      const url = typeof node.url === 'string' ? node.url : '';
      if (/^(javascript|data|vbscript):/i.test(url.trim())) {
        node.url = '#';
      }
    });
  };
};

/**
 * Minimal HTML allowlist for comment content.
 *
 * Allows: inline formatting (strong, em, del, code), blockquote, ordered and
 * unordered lists, anchor links.
 *
 * Blocks: img, iframe, script, object, embed, pre (no code blocks/highlight),
 * and all event handler attributes.
 */
const commentSanitizeSchema = {
  tagNames: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'del',
    'strike',
    's',
    'code',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'hr',
  ],
  attributes: {
    a: ['href', 'title'],
  },
  protocols: {
    href: ['http', 'https'],
  },
} satisfies Schema;

function createCommentProcessor() {
  const instance = unified();
  const remarkRehypePlugin = remarkRehype as unknown as Plugin<[{ allowDangerousHtml: boolean }]>;
  instance.use(remarkParse);
  instance.use(remarkGfm);
  instance.use(remarkStripDangerousLinks);
  instance.use(remarkRehypePlugin, { allowDangerousHtml: false });
  instance.use(rehypeSanitize, commentSanitizeSchema);
  instance.use(rehypeExternalLinks, {
    target: '_blank',
    rel: ['nofollow', 'ugc', 'noreferrer'],
  });
  instance.use(rehypeStringify);
  return instance;
}

let commentProcessor: ReturnType<typeof createCommentProcessor> | undefined;

function getCommentProcessor() {
  if (!commentProcessor) {
    commentProcessor = createCommentProcessor();
  }
  return commentProcessor;
}

/**
 * Render comment Markdown to safe, restricted HTML.
 *
 * This pipeline is intentionally minimal — it does not allow images, code
 * blocks with syntax highlighting, Mermaid diagrams, or iframes. All external
 * links get rel="nofollow ugc noreferrer" and target="_blank".
 */
export async function renderCommentMarkdown(content: string): Promise<string> {
  const processor = getCommentProcessor();
  const result = await processor.process(content);
  return String(result);
}
