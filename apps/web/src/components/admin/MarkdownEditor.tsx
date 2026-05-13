'use client';

import { Eye, PenLine } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logClientError } from '@/lib/client-logger';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';

/**
 * Renders a raw Mermaid diagram source string client-side.
 * Used only in the MarkdownEditor preview tab.
 */
function MermaidBlock({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let cancelled = false;

    const isDark = document.documentElement.classList.contains('dark');
    const theme = isDark ? ('dark' as const) : ('default' as const);

    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          theme,
          securityLevel: 'strict',
          fontFamily: 'var(--font-mono-jetbrains, monospace)',
        });
        node.removeAttribute('data-processed');
        node.textContent = source;
        mermaid.run({ nodes: [node] }).catch((err: unknown) => {
          if (cancelled) return;
          logClientError('MarkdownEditor/MermaidBlock', 'Failed to render diagram', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logClientError('MarkdownEditor/MermaidBlock', 'Failed to load mermaid', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return <div ref={ref} className="mermaid my-4" />;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escreva em Markdown...',
  minHeight = 400,
  maxHeight = 700,
  className,
  disabled,
}: MarkdownEditorProps) {
  return (
    <div className={cn('rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden', className)}>
      <Tabs defaultValue="write">
        <div className="flex items-center border-b border-zinc-800 px-3 py-1.5 gap-2 bg-zinc-950/50">
          <TabsList className="h-7 bg-zinc-800/60 p-0.5 gap-0.5">
            <TabsTrigger
              value="write"
              className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
            >
              <PenLine size={11} />
              Editar
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400"
            >
              <Eye size={11} />
              Preview
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-zinc-600 font-mono ml-auto">{value.length} chars</span>
        </div>

        <TabsContent value="write" className="m-0">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'min-h-0 resize-none rounded-none border-0 bg-transparent',
              'font-mono text-sm text-zinc-300 placeholder:text-zinc-600',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'p-4 leading-relaxed overflow-y-auto field-sizing-fixed'
            )}
            style={{ minHeight, maxHeight }}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div
            className="p-4 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none prose-portfolio"
            style={{ minHeight, maxHeight }}
          >
            {value ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const language = /language-(\w+)/.exec(className ?? '')?.[1];
                    if (language === 'mermaid') {
                      return <MermaidBlock source={String(children).replace(/\n$/, '')} />;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-zinc-600 italic text-sm">Nenhum conteúdo para pré-visualizar.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
