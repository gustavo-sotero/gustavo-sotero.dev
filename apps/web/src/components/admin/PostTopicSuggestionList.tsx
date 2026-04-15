'use client';

import type { TopicSuggestion } from '@portfolio/shared';
import { AI_POST_CATEGORY_META } from '@portfolio/shared';
import { ArrowLeft, RefreshCcw, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface PostTopicSuggestionListProps {
  topics: TopicSuggestion[];
  onSelect: (topic: TopicSuggestion) => void;
  onRegenerate: () => void;
  onReset: () => void;
  isRegenerating: boolean;
}

export function PostTopicSuggestionList({
  topics,
  onSelect,
  onRegenerate,
  onReset,
  isRegenerating,
}: PostTopicSuggestionListProps) {
  return (
    <div className="pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">Escolha um tema</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs text-zinc-500 hover:text-zinc-300 gap-1.5"
          >
            <RefreshCcw className={cn('h-3 w-3', isRegenerating && 'animate-spin')} />
            Outros temas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {topics.map((topic) => (
          <button
            key={topic.suggestionId}
            type="button"
            onClick={() => onSelect(topic)}
            disabled={isRegenerating}
            className={cn(
              'w-full text-left rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3',
              'hover:border-emerald-500/40 hover:bg-zinc-800/60 transition-colors group',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-emerald-300 transition-colors mb-1">
              {topic.proposedTitle}
            </p>
            <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{topic.summary}</p>
            <div className="grid gap-2 mb-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-emerald-400/80">Recorte</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{topic.angle}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Leitor</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{topic.targetReader}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-2">
              <span className="text-zinc-400">Por que vale:</span> {topic.rationale}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs px-1.5 py-0 bg-emerald-950/40 text-emerald-400 border-emerald-700/40"
              >
                {AI_POST_CATEGORY_META[topic.category]?.label ?? topic.category}
              </Badge>
              {topic.suggestedTagNames.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 bg-zinc-800 text-zinc-400 border-zinc-700"
                >
                  <Tag className="h-2.5 w-2.5 mr-1 opacity-60" />
                  {tag}
                </Badge>
              ))}
              {topic.suggestedTagNames.length > 4 && (
                <span className="text-xs text-zinc-600">+{topic.suggestedTagNames.length - 4}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
