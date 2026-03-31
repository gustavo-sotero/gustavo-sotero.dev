'use client';

import { useEffect, useRef, useState } from 'react';
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
 * Security: uses `securityLevel: 'strict'` (Mermaid v11 default). In v11, strict mode
 * sanitizes URLs and encodes raw HTML within diagram labels — it does NOT use iframes
 * (that is `securityLevel: 'sandbox'`). The diagram source itself is safe because it
 * came from admin-controlled Markdown processed through rehype-sanitize on the backend.
 *
 * Backend generates <div class="mermaid" data-content="<base64>"> placeholders;
 * this component decodes them and calls mermaid.run() client-side.
 *
 * On load or render failure, a visible fallback notice is shown below the content
 * so the reader knows diagrams could not be rendered rather than seeing silent gaps.
 */
export function MermaidRenderer({ html }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    setRenderError(false);

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
          securityLevel: 'strict',
          fontFamily: 'var(--font-mono-jetbrains, monospace)',
        });

        let decodeError = false;
        nodes.forEach((node) => {
          const encoded = node.getAttribute('data-content');
          if (!encoded) return;
          let decoded: string;
          try {
            // Decode base64 → UTF-8 (backend stores diagram as Buffer.toString('base64'))
            decoded = new TextDecoder().decode(
              Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
            );
          } catch {
            decodeError = true;
            return;
          }
          // Clear previous render artifacts
          node.removeAttribute('data-processed');
          node.textContent = decoded;
        });

        if (decodeError) {
          logClientError('MermaidRenderer', 'Failed to decode base64 diagram content', {
            nodeCount: nodes.length,
          });
          if (!cancelled) setRenderError(true);
          return;
        }

        mermaid.run({ nodes: Array.from(nodes) }).catch((err: unknown) => {
          if (cancelled) return;
          logClientError('MermaidRenderer', 'Failed to render mermaid diagram', {
            error: err instanceof Error ? err.message : String(err),
            nodeCount: nodes.length,
          });
          setRenderError(true);
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logClientError('MermaidRenderer', 'Failed to load mermaid library', {
          error: err instanceof Error ? err.message : String(err),
          nodeCount: nodes.length,
        });
        setRenderError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <>
      <div
        ref={containerRef}
        className="prose prose-zinc dark:prose-invert max-w-none prose-portfolio"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted backend boundary for sanitized markdown HTML with client-side mermaid hydration
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {renderError && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-400"
        >
          Alguns diagramas não puderam ser renderizados. O conteúdo bruto está exibido acima.
        </div>
      )}
    </>
  );
}
