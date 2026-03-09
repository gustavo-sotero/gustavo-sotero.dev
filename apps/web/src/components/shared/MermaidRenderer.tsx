'use client';

import { useEffect, useRef } from 'react';
import { logClientError } from '@/lib/client-logger';

interface MermaidRendererProps {
  html: string;
}

/**
 * Load the mermaid library via dynamic import (bundled locally — no CDN dependency).
 * Returns the default export which is the mermaid API object.
 */
async function loadMermaid() {
  const mod = await import('mermaid');
  return mod.default;
}

/**
 * Client Component that initializes Mermaid diagrams after the HTML is mounted.
 *
 * Security: uses `securityLevel: 'strict'` which sandboxes diagram rendering in
 * an iframe, preventing XSS through malicious diagram source even if the upstream
 * sanitization pipeline were ever bypassed.
 *
 * Backend generates <div class="mermaid" data-content="<base64>"> placeholders;
 * this component decodes them and calls mermaid.run() client-side.
 */
export function MermaidRenderer({ html }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!html.trim()) return;

    const container = containerRef.current;
    if (!container) return;

    const nodes = container.querySelectorAll<HTMLDivElement>('.mermaid[data-content]');
    if (nodes.length === 0) return;

    let cancelled = false;

    const isDark = document.documentElement.classList.contains('dark');
    // Mermaid's theme type only accepts 'default' | 'base' | 'dark' | 'forest' | 'neutral' | 'null'
    const theme = isDark ? ('dark' as const) : ('default' as const);

    loadMermaid()
      .then((mermaid) => {
        if (cancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          theme,
          // 'strict' sandboxes rendering in an iframe, preventing XSS from
          // diagram source — do NOT downgrade to 'loose' or 'antiscript'.
          securityLevel: 'strict',
          fontFamily: 'var(--font-mono-jetbrains, monospace)',
        });

        nodes.forEach((node) => {
          const encoded = node.getAttribute('data-content');
          if (!encoded) return;
          // Decode base64 → UTF-8 (backend stores diagram as Buffer.toString('base64'))
          const decoded = new TextDecoder().decode(
            Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
          );
          // Clear previous render artifacts
          node.removeAttribute('data-processed');
          node.textContent = decoded;
        });

        mermaid.run({ nodes: Array.from(nodes) }).catch((err: unknown) => {
          logClientError('MermaidRenderer', 'Failed to render mermaid diagram', {
            error: err instanceof Error ? err.message : String(err),
            nodeCount: nodes.length,
          });
        });
      })
      .catch((err: unknown) => {
        logClientError('MermaidRenderer', 'Failed to load mermaid library', {
          error: err instanceof Error ? err.message : String(err),
          nodeCount: nodes.length,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="prose prose-zinc dark:prose-invert max-w-none prose-portfolio"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted backend boundary for sanitized markdown HTML with client-side mermaid hydration
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
