'use client';

import type { AiPostGenerationModelSummary } from '@portfolio/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { adminKeys } from '@/hooks/admin/query-keys';
import {
  getAiPostGenerationModels,
  useAiPostGenerationConfig,
  useAiPostGenerationModels,
  useUpdateAiPostGenerationConfig,
} from '@/hooks/admin/use-ai-post-generation-config';

const MODELS_PER_PAGE = 8;

function formatContextLength(contextLength: number | null): string | null {
  if (!contextLength) {
    return null;
  }

  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(1).replace('.0', '')}M ctx`;
  }

  return `${Math.round(contextLength / 1_000)}k ctx`;
}

function formatPricePerMillion(pricePerToken: string | null, label: string): string | null {
  if (!pricePerToken) {
    return null;
  }

  const parsed = Number(pricePerToken);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const perMillion = parsed * 1_000_000;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: perMillion < 1 ? 3 : 2,
    maximumFractionDigits: perMillion < 1 ? 3 : 2,
  }).format(perMillion);

  return `${label} ${formatted}/M`;
}

function SavedModelCard({ label, modelId }: { label: string; modelId: string }) {
  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-zinc-300">{modelId}</p>
    </div>
  );
}

// ── Status indicator ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    ready: {
      icon: CheckCircle2,
      label: 'Pronto',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    'not-configured': {
      icon: AlertCircle,
      label: 'Não configurado',
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    },
    disabled: {
      icon: XCircle,
      label: 'Desabilitado',
      className: 'bg-zinc-700/50 text-zinc-500 border-zinc-700',
    },
    'invalid-config': {
      icon: AlertTriangle,
      label: 'Configuração inválida',
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    'catalog-unavailable': {
      icon: AlertCircle,
      label: 'Catálogo indisponível',
      className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    },
  };

  const v = variants[status] ??
    variants['not-configured'] ?? { icon: AlertCircle, label: status, className: '' };
  const Icon = v.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${v.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {v.label}
    </span>
  );
}

// ── Model selector ────────────────────────────────────────────────────────────

interface ModelSelectorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  models: AiPostGenerationModelSummary[];
  total: number;
  totalPages: number;
  isLoadingModels: boolean;
  isFetchingModels: boolean;
  isErrorModels: boolean;
}

function ModelSelector({
  label,
  value,
  onChange,
  searchQuery,
  onSearchChange,
  page,
  onPageChange,
  models,
  total,
  totalPages,
  isLoadingModels,
  isFetchingModels,
  isErrorModels,
}: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-zinc-300">{label}</Label>
        <span className="text-[11px] text-zinc-500">
          {total} modelo{total === 1 ? '' : 's'} elegíveis
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar modelos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm h-8"
        />
      </div>

      {isErrorModels ? (
        <div className="rounded-md border border-red-800/40 bg-red-500/5 px-3 py-3 text-xs text-red-300">
          Não foi possível carregar esta fatia do catálogo agora.
        </div>
      ) : isLoadingModels ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full bg-zinc-800/60 rounded" />
          ))}
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-md border border-zinc-700/60 bg-zinc-900/60 divide-y divide-zinc-800/60">
          {models.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-500">
              {searchQuery
                ? 'Nenhum modelo encontrado para esta busca.'
                : 'Nenhum modelo disponível.'}
            </p>
          ) : (
            models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(m.id)}
                className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-800/60 ${
                  value === m.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-100">{m.name}</p>
                      <span className="rounded-full border border-zinc-700/70 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                        {m.providerFamily}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">{m.id}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {m.description || 'Sem descrição detalhada no catálogo.'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                      {formatContextLength(m.contextLength) && (
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1">
                          {formatContextLength(m.contextLength)}
                        </span>
                      )}
                      {m.maxCompletionTokens && (
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1">
                          saída máx. {Math.round(m.maxCompletionTokens / 1000)}k
                        </span>
                      )}
                      {formatPricePerMillion(m.inputPrice, 'Entrada') && (
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1">
                          {formatPricePerMillion(m.inputPrice, 'Entrada')}
                        </span>
                      )}
                      {formatPricePerMillion(m.outputPrice, 'Saída') && (
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1">
                          {formatPricePerMillion(m.outputPrice, 'Saída')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {totalPages > 1 && !isErrorModels && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800/70 bg-zinc-950/30 px-3 py-2">
          <p className="text-xs text-zinc-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoadingModels || isFetchingModels}
              className="h-7 border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800"
              aria-label={`${label}: página anterior`}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoadingModels || isFetchingModels}
              className="h-7 border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800"
              aria-label={`${label}: próxima página`}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {value && (
        <p className="text-xs text-zinc-500">
          Selecionado: <span className="font-mono text-zinc-300">{value}</span>
        </p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AiPostGenerationSettingsPanel() {
  const queryClient = useQueryClient();
  const {
    data: configState,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch,
  } = useAiPostGenerationConfig();

  const [topicsModelId, setTopicsModelId] = useState('');
  const [draftModelId, setDraftModelId] = useState('');
  const [topicsSearch, setTopicsSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [topicsPage, setTopicsPage] = useState(1);
  const [draftPage, setDraftPage] = useState(1);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const deferredTopicsSearch = useDeferredValue(topicsSearch);
  const deferredDraftSearch = useDeferredValue(draftSearch);

  const topicsModelsParams = {
    page: topicsPage,
    perPage: MODELS_PER_PAGE,
    q: deferredTopicsSearch || undefined,
  };
  const draftModelsParams = {
    page: draftPage,
    perPage: MODELS_PER_PAGE,
    q: deferredDraftSearch || undefined,
  };

  const topicsModelsQuery = useAiPostGenerationModels(topicsModelsParams);
  const draftModelsQuery = useAiPostGenerationModels(draftModelsParams);

  const { mutate: save, isPending: isSaving } = useUpdateAiPostGenerationConfig();

  // Pre-fill from saved config on initial load
  const savedTopicsModel = configState?.config?.topicsModelId ?? '';
  const savedDraftModel = configState?.config?.draftModelId ?? '';
  const effectiveTopics = topicsModelId || savedTopicsModel;
  const effectiveDraft = draftModelId || savedDraftModel;
  const hasCatalogError = topicsModelsQuery.isError || draftModelsQuery.isError;

  async function handleRefreshCatalog() {
    setIsRefreshingCatalog(true);

    try {
      await Promise.allSettled([
        queryClient.fetchQuery({
          queryKey: adminKeys.aiPostGenerationModels(topicsModelsParams),
          queryFn: () => getAiPostGenerationModels({ ...topicsModelsParams, forceRefresh: true }),
        }),
        queryClient.fetchQuery({
          queryKey: adminKeys.aiPostGenerationModels(draftModelsParams),
          queryFn: () => getAiPostGenerationModels({ ...draftModelsParams, forceRefresh: true }),
        }),
      ]);

      // The config badge depends on catalog validation, so refresh it after
      // the catalog queries settle to avoid stale `catalog-unavailable` UI.
      await refetch();
    } finally {
      setIsRefreshingCatalog(false);
    }
  }

  function handleSave() {
    if (!effectiveTopics || !effectiveDraft) return;
    save({ topicsModelId: effectiveTopics, draftModelId: effectiveDraft });
  }

  if (isLoadingConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full bg-zinc-800/60 rounded-lg" />
        <Skeleton className="h-64 w-full bg-zinc-800/60 rounded-lg" />
      </div>
    );
  }

  if (isErrorConfig) {
    return (
      <div className="rounded-lg border border-red-800/50 bg-red-500/5 p-4 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">Erro ao carregar configuração. Recarregue a página.</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="ml-auto text-xs text-zinc-400"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const isDisabled = configState?.status === 'disabled';

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
              <Bot className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Status da geração com IA</p>
              {configState?.updatedAt && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  Última atualização:{' '}
                  {new Date(configState.updatedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {configState?.updatedBy && (
                <p className="text-xs text-zinc-600 mt-1">Atualizado por {configState.updatedBy}</p>
              )}
            </div>
          </div>
          <StatusBadge status={configState?.status ?? 'not-configured'} />
        </div>

        {configState?.config && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SavedModelCard label="Tópicos ativos" modelId={configState.config.topicsModelId} />
            <SavedModelCard label="Rascunho ativo" modelId={configState.config.draftModelId} />
          </div>
        )}

        {configState?.status !== 'disabled' &&
          configState?.issues &&
          configState.issues.length > 0 && (
            <ul className="mt-3 space-y-1">
              {configState.issues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-xs text-yellow-400/90">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          )}
      </div>

      {isDisabled && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-4 text-center">
          <p className="text-sm text-zinc-500">
            A geração de posts com IA está{' '}
            <span className="font-semibold text-zinc-400">desabilitada</span> nesta instância.
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Configure <code className="text-zinc-500">AI_POSTS_ENABLED=true</code> e{' '}
            <code className="text-zinc-500">OPENROUTER_API_KEY</code> no servidor para ativá-la.
          </p>
        </div>
      )}

      {!isDisabled && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 mb-0.5">Modelos ativos</h2>
              <p className="text-xs text-zinc-500">
                Selecione modelos do catálogo OpenRouter que suportam saída estruturada.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshCatalog}
              disabled={isRefreshingCatalog}
              className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isRefreshingCatalog ? 'animate-spin' : ''}`}
              />
              Atualizar catálogo
            </Button>
          </div>

          {configState?.status === 'catalog-unavailable' && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-orange-200">
              O catálogo do OpenRouter está indisponível no momento. Você ainda pode revisar a
              configuração salva, mas uma nova gravação só deve ser feita após atualizar o catálogo.
            </div>
          )}

          {hasCatalogError && (
            <div className="rounded-lg border border-red-800/50 bg-red-500/5 px-4 py-3 text-sm text-red-200">
              Não foi possível carregar a listagem de modelos agora. Tente atualizar o catálogo
              antes de salvar uma nova configuração.
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <ModelSelector
              label="Modelo de tópicos"
              value={effectiveTopics}
              onChange={setTopicsModelId}
              searchQuery={topicsSearch}
              onSearchChange={(value) => {
                setTopicsSearch(value);
                setTopicsPage(1);
              }}
              page={topicsPage}
              onPageChange={setTopicsPage}
              models={topicsModelsQuery.data?.data ?? []}
              total={topicsModelsQuery.data?.meta.total ?? 0}
              totalPages={topicsModelsQuery.data?.meta.totalPages ?? 1}
              isLoadingModels={topicsModelsQuery.isLoading}
              isFetchingModels={topicsModelsQuery.isFetching || isRefreshingCatalog}
              isErrorModels={topicsModelsQuery.isError}
            />

            <ModelSelector
              label="Modelo de rascunho"
              value={effectiveDraft}
              onChange={setDraftModelId}
              searchQuery={draftSearch}
              onSearchChange={(value) => {
                setDraftSearch(value);
                setDraftPage(1);
              }}
              page={draftPage}
              onPageChange={setDraftPage}
              models={draftModelsQuery.data?.data ?? []}
              total={draftModelsQuery.data?.meta.total ?? 0}
              totalPages={draftModelsQuery.data?.meta.totalPages ?? 1}
              isLoadingModels={draftModelsQuery.isLoading}
              isFetchingModels={draftModelsQuery.isFetching || isRefreshingCatalog}
              isErrorModels={draftModelsQuery.isError}
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Os modelos são validados contra o catálogo ao salvar.
            </p>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                isRefreshingCatalog ||
                hasCatalogError ||
                !effectiveTopics ||
                !effectiveDraft
              }
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar configuração
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
