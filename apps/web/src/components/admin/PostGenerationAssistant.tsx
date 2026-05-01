'use client';

import {
  AI_POST_CATEGORY_META,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_BRIEFING_CHARS,
  AI_POST_REQUESTED_CATEGORIES,
} from '@portfolio/shared/constants/ai-posts';
import type { createPostSchema } from '@portfolio/shared/schemas/posts';
import type {
  AiPostRequestedCategory,
  GenerateDraftResponse,
  TopicSuggestion,
} from '@portfolio/shared/types/ai-post-generation';
import type { Tag } from '@portfolio/shared/types/tags';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Settings,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { z } from 'zod';
import { useResolveAiSuggestedTags } from '@/hooks/admin/use-admin-tags';
import { useAiPostGenerationConfig } from '@/hooks/admin/use-ai-post-generation-config';
import {
  useGeneratePostDraftRun,
  useGeneratePostTopicsRun,
} from '@/hooks/admin/use-post-generation';
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
  | {
      step: 'topicsReady';
      topics: TopicSuggestion[];
      category: AiPostRequestedCategory;
      briefing: string;
    }
  | {
      step: 'generatingDraft';
      selected: TopicSuggestion;
      category: AiPostRequestedCategory;
      briefing: string;
      /** Preserved so "back to topics" can restore without a new API call. */
      topics: TopicSuggestion[];
    }
  | {
      step: 'draftReady';
      selected: TopicSuggestion;
      category: AiPostRequestedCategory;
      briefing: string;
      draft: GenerateDraftResponse;
      /** Preserved so "back to topics" can restore without a new API call. */
      topics: TopicSuggestion[];
    }
  | {
      step: 'error';
      message: string;
      kind: string;
      /** Present when error occurred during draft generation — allows returning to topic list. */
      topics?: TopicSuggestion[];
      category?: AiPostRequestedCategory;
      briefing?: string;
      selected?: TopicSuggestion;
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

const DRAFT_STAGE_LABELS: Record<string, string> = {
  queued: 'Solicitação recebida...',
  'resolving-config': 'Verificando configuração...',
  'building-prompt': 'Construindo prompt...',
  'requesting-provider': 'Aguardando resposta do modelo de IA...',
  'normalizing-output': 'Normalizando resultado...',
  'canonicalizing-tags': 'Processando tags...',
  'validating-output': 'Validando draft...',
  'persisting-result': 'Salvando resultado...',
};

const TOPIC_STAGE_LABELS: Record<string, string> = {
  queued: 'Solicitação recebida...',
  'resolving-config': 'Verificando configuração...',
  'building-prompt': 'Construindo prompt...',
  'requesting-provider': 'Aguardando resposta do modelo de IA...',
  'normalizing-output': 'Normalizando resultado...',
  'canonicalizing-tags': 'Processando tags...',
  'validating-output': 'Validando sugestões...',
  'persisting-result': 'Salvando resultado...',
};

export function PostGenerationAssistant({
  setValue,
  allTags,
  currentValues,
  onTagsApplied,
}: PostGenerationAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState<AiPostRequestedCategory | ''>('');
  const [briefing, setBriefing] = useState('');
  const [state, setState] = useState<AssistantState>({ step: 'idle' });
  const [excludedIdeas, setExcludedIdeas] = useState<string[]>([]);
  const [rejectedAngles, setRejectedAngles] = useState<string[]>([]);

  const topicsRunHook = useGeneratePostTopicsRun();
  const draftRunHook = useGeneratePostDraftRun();
  const { data: configState, isLoading: isLoadingConfig } = useAiPostGenerationConfig();
  const resolveAiTagsMutation = useResolveAiSuggestedTags();

  function handleCategoryChange(nextCategory: AiPostRequestedCategory) {
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
    topicCategory: AiPostRequestedCategory,
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

  async function runDraftGeneration(
    topic: TopicSuggestion,
    draftCategory: AiPostRequestedCategory,
    draftBriefing: string,
    topics: TopicSuggestion[],
    overrideRejectedAngles?: string[]
  ) {
    setState({
      step: 'generatingDraft',
      selected: topic,
      category: draftCategory,
      briefing: draftBriefing,
      topics,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        draftRunHook.start(
          {
            category: draftCategory,
            briefing: draftBriefing || null,
            selectedSuggestion: topic,
            rejectedAngles: overrideRejectedAngles ?? rejectedAngles,
          },
          {
            onCompleted: (run) => {
              const draft = run.result as import('@portfolio/shared').GenerateDraftResponse;
              if (!draft) {
                reject(new Error('O draft gerado está vazio. Tente novamente.'));
                return;
              }
              setState((prev) => {
                if (prev.step !== 'generatingDraft') return prev;
                return {
                  step: 'draftReady',
                  selected: topic,
                  category: draftCategory,
                  briefing: draftBriefing,
                  draft,
                  topics,
                };
              });
              resolve();
            },
            onError: reject,
          }
        );
      });
    } catch (err) {
      const { message, kind } = extractErrorMessage(err);
      setState({
        step: 'error',
        message,
        kind,
        topics,
        category: draftCategory,
        briefing: draftBriefing,
        selected: topic,
      });
    }
  }

  async function handleGenerateTopics(overrideExcludedIdeas?: string[]) {
    if (!category) return;
    // Use provided override to avoid stale-closure issues on regenerate
    const effectiveExcluded = overrideExcludedIdeas ?? excludedIdeas;
    const capturedCategory = category;
    const capturedBriefing = briefing;
    setState({ step: 'generatingTopics' });
    try {
      await new Promise<void>((resolve, reject) => {
        void topicsRunHook.start(
          {
            category: capturedCategory,
            briefing: capturedBriefing || null,
            limit: AI_POST_DEFAULT_SUGGESTIONS,
            excludedIdeas: effectiveExcluded,
          },
          {
            onCompleted: (run) => {
              const topicsResult = run.result as { suggestions: TopicSuggestion[] } | null;
              if (!topicsResult?.suggestions?.length) {
                reject(new Error('Nenhum tema foi gerado. Tente novamente.'));
                return;
              }
              setState({
                step: 'topicsReady',
                topics: topicsResult.suggestions,
                category: capturedCategory,
                briefing: capturedBriefing,
              });
              resolve();
            },
            onError: reject,
          }
        );
      });
    } catch (err) {
      const { message, kind } = extractErrorMessage(err);
      setState({ step: 'error', message, kind });
    }
  }

  async function handleSelectTopic(topic: TopicSuggestion, overrideRejectedAngles?: string[]) {
    // Allow regeneration from draftReady as well as initial selection from topicsReady
    if (state.step !== 'topicsReady' && state.step !== 'draftReady') return;
    await runDraftGeneration(
      topic,
      state.category,
      state.briefing,
      state.topics,
      overrideRejectedAngles
    );
  }

  async function handleRetrySelectedTopic() {
    if (
      state.step !== 'error' ||
      !state.selected ||
      !state.topics ||
      !state.category ||
      state.briefing === undefined
    ) {
      return;
    }

    await runDraftGeneration(
      state.selected,
      state.category,
      state.briefing,
      state.topics,
      rejectedAngles
    );
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
    topicsRunHook.reset();
    draftRunHook.reset();
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
                        onValueChange={(v) => handleCategoryChange(v as AiPostRequestedCategory)}
                      >
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/40">
                          <SelectValue placeholder="Escolha uma categoria..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {AI_POST_REQUESTED_CATEGORIES.map((cat) => (
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
                        {state.selected && (
                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-3 space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-zinc-200">
                                    {state.selected.proposedTitle}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] px-1.5 py-0 bg-emerald-950/40 text-emerald-400 border-emerald-700/40"
                                  >
                                    {AI_POST_CATEGORY_META[state.selected.category].label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-zinc-400">{state.selected.angle}</p>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                  {state.selected.summary}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  void handleRetrySelectedTopic();
                                }}
                                disabled={isLoading}
                                className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                              >
                                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                                Tentar novamente com este tema
                              </Button>
                            </div>
                            <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                              Você pode tentar novamente com o mesmo tema ou escolher outro abaixo.
                            </p>
                          </div>
                        )}
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
                  <div className="pt-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Gerando sugestões de temas...
                    </div>
                    {topicsRunHook.stage && (
                      <p className="text-xs text-zinc-500 pl-6">
                        {TOPIC_STAGE_LABELS[topicsRunHook.stage] ?? topicsRunHook.stage}
                      </p>
                    )}
                  </div>
                )}
                {state.step === 'generatingDraft' && (
                  <div className="pt-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando draft do post...
                    </div>
                    {draftRunHook.stage && (
                      <p className="text-xs text-zinc-500 pl-6">
                        {DRAFT_STAGE_LABELS[draftRunHook.stage] ?? draftRunHook.stage}
                      </p>
                    )}
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

                {state.step === 'error' &&
                  state.topics &&
                  state.category &&
                  state.briefing !== undefined && (
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
                      onTagsApplied?.(fields.tagIds);
                      setValue('tagIds', fields.tagIds);
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
                    isRegenerating={draftRunHook.isPending}
                    resolveAiTags={async (names) => {
                      const result = await resolveAiTagsMutation.mutateAsync(names);
                      const resolvedTags =
                        (result?.data as import('@portfolio/shared').Tag[] | undefined) ?? [];
                      return resolvedTags.map((t) => t.id);
                    }}
                  />
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}
