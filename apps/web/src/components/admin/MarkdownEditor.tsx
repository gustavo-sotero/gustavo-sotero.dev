'use client';

import { Eye, PenLine } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escreva em Markdown...',
  minHeight = 400,
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
              'p-4 leading-relaxed'
            )}
            style={{ minHeight }}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div
            className={cn(
              'p-4 overflow-y-auto',
              'prose prose-sm prose-zinc dark:prose-invert max-w-none',
              'prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-strong:text-zinc-200',
              'prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded',
              'prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700',
              'prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline',
              'prose-blockquote:border-emerald-500/40 prose-blockquote:text-zinc-400',
              'prose-hr:border-zinc-800',
              'prose-table:text-zinc-300 prose-th:text-zinc-200 prose-td:border-zinc-800 prose-th:border-zinc-700'
            )}
            style={{ minHeight }}
          >
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-zinc-600 italic text-sm">Nenhum conteúdo para pré-visualizar.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
