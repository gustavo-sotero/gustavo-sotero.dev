'use client';

import type { AiPostCategory, createPostSchema, Tag, TopicSuggestion } from '@portfolio/shared';
import {
  AI_POST_CATEGORIES,
  AI_POST_CATEGORY_META,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_BRIEFING_CHARS,
} from '@portfolio/shared';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCcw,
  Settings,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { z } from 'zod';
import { useAiPostGenerationConfig } from '@/hooks/admin/use-ai-post-generation-config';
import { useGeneratePostDraft, useGeneratePostTopics } from '@/hooks/admin/use-post-generation';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { PostDraftReview } from './PostDraftReview';
import { PostTopicSuggestionList } from './PostTopicSuggestionList';

type PostFormValues = z.input<typeof createPostSchema>;

export interface PostGenerationAssistantProps {
  setValue: UseFormSetValue<PostFormValues>;
  allTags: Tag[];
  currentValues: Pick<PostFormValues, 'title' | 'slug' | 'excerpt' | 'content' | 'tagIds'>;
  /** Called when the draft applies tag IDs to the form */
  onTagsApplied?: (tagIds: number[]) => void;
}

type AssistantState =
  | { step: 'idle' }
  | { step: 'generatingTopics' }
  | { step: 'topicsReady'; topics: TopicSuggestion[]; category: AiPostCategory; briefing: string }
  | {
      step: 'generatingDraft';
      selected: TopicSuggestion;
      category: AiPostCategory;
      briefing: string;
      /** Preserved so "back to topics" can restore without a new API call. */
      topics: TopicSuggestion[];
    }
  | {
      step: 'draftReady';
      selected: TopicSuggestion;
      category: AiPostCategory;
      briefing: string;
      draft: import('@portfolio/shared').GenerateDraftResponse;
      /** Preserved so "back to topics" can restore without a new API call. */
      topics: TopicSuggestion[];
    }
  | {
      step: 'error';
      message: string;
      kind: string;
      /** Present when error occurred during draft generation — allows returning to topic list. */
      topics?: TopicSuggestion[];
      category?: AiPostCategory;
      briefing?: string;
    };

function extractErrorMessage(err: unknown): { message: string; kind: string } {
  const anyErr = err as Record<string, unknown>;
  // API error envelope
  if (anyErr?.error && typeof anyErr.error === 'object') {
    const apiErr = anyErr.error as Record<string, unknown>;
    if (typeof apiErr.message === 'string') {
      return {
        message: apiErr.message,
        kind: typeof apiErr.code === 'string' ? apiErr.code : 'unknown',
      };
    }
  }
  if (typeof anyErr?.message === 'string') {
    return { message: anyErr.message as string, kind: 'unknown' };
  }
  return { message: 'Erro inesperado. Tente novamente.', kind: 'unknown' };
}

export function PostGenerationAssistant({
  setValue,
  allTags,
  currentValues,
  onTagsApplied,
}: PostGenerationAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState<AiPostCategory | ''>('');
  const [briefing, setBriefing] = useState('');
  const [state, setState] = useState<AssistantState>({ step: 'idle' });
  const [excludedIdeas, setExcludedIdeas] = useState<string[]>([]);
  const [rejectedAngles, setRejectedAngles] = useState<string[]>([]);

  const topicsMutation = useGeneratePostTopics();
  const draftMutation = useGeneratePostDraft();
  const { data: configState, isLoading: isLoadingConfig } = useAiPostGenerationConfig();

  function handleCategoryChange(nextCategory: AiPostCategory) {
    setCategory((currentCategory) => {
      if (currentCategory && currentCategory !== nextCategory) {
        setExcludedIdeas([]);
        setRejectedAngles([]);
      }
      return nextCategory;
    });
  }

  function restoreTopics(
    topics: TopicSuggestion[],
    topicCategory: AiPostCategory,
    topicBriefing: string
  ) {
    setRejectedAngles([]);
    setState({
      step: 'topicsReady',
      topics,
      category: topicCategory,
      briefing: topicBriefing,
    });
  }

  async function handleGenerateTopics(overrideExcludedIdeas?: string[]) {
    if (!category) return;
    // Use provided override to avoid stale-closure issues on regenerate
    const effectiveExcluded = overrideExcludedIdeas ?? excludedIdeas;
    setState({ step: 'generatingTopics' });
    try {
      const result = await topicsMutation.mutateAsync({
        category,
        briefing: briefing || null,
        limit: AI_POST_DEFAULT_SUGGESTIONS,
        excludedIdeas: effectiveExcluded,
      });
      setState({ step: 'topicsReady', topics: result.suggestions, category, briefing });
    } catch (err) {
      const { message, kind } = extractErrorMessage(err);
      setState({ step: 'error', message, kind });
    }
  }

  async function handleSelectTopic(topic: TopicSuggestion, overrideRejectedAngles?: string[]) {
    // Allow regeneration from draftReady as well as initial selection from topicsReady
    if (state.step !== 'topicsReady' && state.step !== 'draftReady') return;
    const currentCategory = state.category;
    const currentBriefing = state.briefing;
    // Preserve the topic list so "back to topics" can restore without a new call
    const currentTopics = state.topics;
    setState({
      step: 'generatingDraft',
      selected: topic,
      category: currentCategory,
      briefing: currentBriefing,
      topics: currentTopics,
    });
    try {
      const draft = await draftMutation.mutateAsync({
        category: currentCategory,
        briefing: currentBriefing || null,
        selectedSuggestion: topic,
        // Use provided override to avoid stale-closure issues on regenerate
        rejectedAngles: overrideRejectedAngles ?? rejectedAngles,
      });
      // Guard: only transition if we're still in the generatingDraft step
      // (the user may have navigated away while the request was in flight)
      setState((prev) => {
        if (prev.step !== 'generatingDraft') return prev;
        return {
          step: 'draftReady',
          selected: topic,
          category: currentCategory,
          briefing: currentBriefing,
          draft,
          topics: currentTopics,
        };
      });
    } catch (err) {
      const { message, kind } = extractErrorMessage(err);
      // Preserve topic context so the user can return to topics without restarting
      setState({
        step: 'error',
        message,
        kind,
        topics: currentTopics,
        category: currentCategory,
        briefing: currentBriefing,
      });
    }
  }

  function handleRegenerateTopics() {
    // Compute new excluded set immediately to avoid stale-closure on handleGenerateTopics
    let newExcluded = excludedIdeas;
    if (state.step === 'topicsReady') {
      const current = state.topics.map((t) => t.proposedTitle);
      newExcluded = [...new Set([...excludedIdeas, ...current])];
      setExcludedIdeas(newExcluded);
    }
    handleGenerateTopics(newExcluded);
  }

  function handleBackToTopics() {
    if (state.step === 'draftReady' || state.step === 'generatingDraft') {
      restoreTopics(state.topics, state.category, state.briefing);
    } else {
      setState({ step: 'idle' });
    }
  }

  async function handleRegenerateDraft() {
    if (state.step !== 'draftReady') return;
    const angle = state.selected.angle;
    // Compute new rejected set immediately to avoid stale-closure on handleSelectTopic
    const newRejected = [...new Set([...rejectedAngles, angle])];
    setRejectedAngles(newRejected);
    await handleSelectTopic(state.selected, newRejected);
  }

  function handleReset() {
    setState({ step: 'idle' });
    setExcludedIdeas([]);
    setRejectedAngles([]);
  }

  const isLoading = state.step === 'generatingTopics' || state.step === 'generatingDraft';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        aria-expanded={expanded}
        aria-controls="ai-assistant-body"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          Assistente de geração
          <Badge
            variant="secondary"
            className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          >
            IA
          </Badge>
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div id="ai-assistant-body" className="px-4 pb-4 space-y-4 border-t border-zinc-800/60">
          {/* ── Config state gate ── */}
          {isLoadingConfig && (
            <div className="pt-4">
              <Skeleton className="h-10 w-full bg-zinc-800/60 rounded-md" />
            </div>
          )}

          {!isLoadingConfig && configState?.status === 'disabled' && (
            <div className="pt-4 flex items-start gap-2 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-3 py-3 text-sm text-zinc-500">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-zinc-600" />
              <span>
                A geração de posts com IA está{' '}
                <strong className="text-zinc-400">desabilitada</strong> nesta instância.
              </span>
            </div>
          )}

          {!isLoadingConfig &&
            (configState?.status === 'not-configured' ||
              configState?.status === 'invalid-config') && (
              <div className="pt-4 rounded-md border border-yellow-700/40 bg-yellow-500/5 px-3 py-3">
                <div className="flex items-start gap-2 text-sm text-yellow-400/90">
                  <Settings className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p>
                      {configState.status === 'not-configured'
                        ? 'Nenhum modelo configurado ainda.'
                        : 'A configuração de modelos é inválida.'}
                    </p>
                    <Link
                      href="/admin/settings/ai-post-generation"
                      className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
                    >
                      Configurar modelos
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

          {!isLoadingConfig && configState?.status === 'catalog-unavailable' && (
            <div className="pt-4 rounded-md border border-orange-700/40 bg-orange-500/5 px-3 py-3">
              <div className="flex items-start gap-2 text-sm text-orange-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    O catálogo do OpenRouter está temporariamente indisponível. A geração continua
                    usando o último par de modelos validado salvo no admin.
                  </p>
                  <Link
                    href="/admin/settings/ai-post-generation"
                    className="inline-flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200 underline underline-offset-2"
                  >
                    Revisar configuração
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Main assistant body (only when config is ready or catalog-unavailable) ── */}
          {!isLoadingConfig &&
            (configState?.status === 'ready' || configState?.status === 'catalog-unavailable') && (
              <>
                {/* Category + briefing (visible in idle/error) */}
                {(state.step === 'idle' || state.step === 'error') && (
                  <div className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">Categoria editorial</Label>
                      <Select
                        value={category}
                        onValueChange={(v) => handleCategoryChange(v as AiPostCategory)}
                      >
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/40">
                          <SelectValue placeholder="Escolha uma categoria..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {AI_POST_CATEGORIES.map((cat) => (
                            <SelectItem
                              key={cat}
                              value={cat}
                              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                            >
                              {AI_POST_CATEGORY_META[cat].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {category && (
                        <p className="text-xs text-zinc-500">
                          {AI_POST_CATEGORY_META[category].description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ai-briefing" className="text-zinc-300 text-sm">
                        Briefing{' '}
                        <span className="text-zinc-600 text-xs">
                          (opcional — ângulo, público, restrições)
                        </span>
                      </Label>
                      <Textarea
                        id="ai-briefing"
                        value={briefing}
                        onChange={(e) =>
                          setBriefing(e.target.value.slice(0, AI_POST_MAX_BRIEFING_CHARS))
                        }
                        placeholder="Ex: foco em deploys com Dokploy, público CTO/DevOps, evitar CLI básica..."
                        rows={3}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
                      />
                      {briefing.length > AI_POST_MAX_BRIEFING_CHARS - 100 && (
                        <p className="text-xs text-amber-400">
                          {AI_POST_MAX_BRIEFING_CHARS - briefing.length} caracteres restantes
                        </p>
                      )}
                    </div>

                    {state.step === 'error' && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{state.message}</span>
                        </div>
                        {state.topics && state.topics.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !state.topics ||
                                !state.category ||
                                state.briefing === undefined
                              ) {
                                return;
                              }
                              restoreTopics(state.topics, state.category, state.briefing);
                            }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <ArrowLeft className="h-3 w-3" />
                            Voltar para temas
                          </button>
                        )}
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={() => handleGenerateTopics()}
                      disabled={!category || isLoading}
                      className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
                      variant="outline"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Sugerir temas
                    </Button>
                  </div>
                )}

                {/* Loading states */}
                {state.step === 'generatingTopics' && (
                  <div className="pt-4 flex items-center gap-2 text-sm text-zinc-400">
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Gerando sugestões de temas...
                  </div>
                )}
                {state.step === 'generatingDraft' && (
                  <div className="pt-4 flex items-center gap-2 text-sm text-zinc-400">
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Gerando draft do post...
                  </div>
                )}

                {/* Topic suggestions */}
                {state.step === 'topicsReady' && (
                  <PostTopicSuggestionList
                    topics={state.topics}
                    onSelect={handleSelectTopic}
                    onRegenerate={handleRegenerateTopics}
                    onReset={handleReset}
                    isRegenerating={isLoading}
                  />
                )}

                {/* Draft review */}
                {state.step === 'draftReady' && (
                  <PostDraftReview
                    draft={state.draft}
                    allTags={allTags}
                    currentValues={currentValues}
                    onApplyAll={(fields) => {
                      if (fields.title) {
                        setValue('title', fields.title);
                      }
                      if (fields.slug) {
                        setValue('slug', fields.slug);
                      }
                      if (fields.excerpt) {
                        setValue('excerpt', fields.excerpt);
                      }
                      if (fields.content) {
                        setValue('content', fields.content);
                      }
                      if (fields.tagIds && fields.tagIds.length > 0) {
                        onTagsApplied?.(fields.tagIds);
                        setValue('tagIds', fields.tagIds);
                      }
                    }}
                    onApplyField={(field, value) => {
                      if (field === 'tagIds' && Array.isArray(value)) {
                        onTagsApplied?.(value as number[]);
                        setValue('tagIds', value as number[]);
                      } else if (field !== 'tagIds') {
                        // biome-ignore lint/suspicious/noExplicitAny: dynamic field apply
                        setValue(field as any, value as string);
                      }
                    }}
                    onRegenerate={handleRegenerateDraft}
                    onBackToTopics={handleBackToTopics}
                    onDiscard={handleReset}
                    isRegenerating={draftMutation.isPending}
                  />
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}
