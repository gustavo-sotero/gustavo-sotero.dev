'use client';

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
import {
  useAiPostGenerationConfig,
  useAiPostGenerationModels,
  useUpdateAiPostGenerationConfig,
} from '@/hooks/admin/use-ai-post-generation-config';

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
  models: { id: string; name: string; contextLength: number | null }[];
  isLoadingModels: boolean;
}

function ModelSelector({
  label,
  value,
  onChange,
  searchQuery,
  onSearchChange,
  models,
  isLoadingModels,
}: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-300">{label}</Label>

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

      {isLoadingModels ? (
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
                className={`w-full flex items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800/60 ${
                  value === m.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-300'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-xs font-mono text-zinc-500 truncate">{m.id}</p>
                </div>
                {m.contextLength && (
                  <span className="shrink-0 text-xs text-zinc-600 mt-0.5 tabular-nums">
                    {(m.contextLength / 1000).toFixed(0)}k ctx
                  </span>
                )}
              </button>
            ))
          )}
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
  const deferredTopicsSearch = useDeferredValue(topicsSearch);
  const deferredDraftSearch = useDeferredValue(draftSearch);

  const topicsModelsQuery = useAiPostGenerationModels({
    q: deferredTopicsSearch || undefined,
    perPage: 50,
  });
  const draftModelsQuery = useAiPostGenerationModels({
    q: deferredDraftSearch || undefined,
    perPage: 50,
  });

  const { mutate: save, isPending: isSaving } = useUpdateAiPostGenerationConfig();

  // Pre-fill from saved config on initial load
  const savedTopicsModel = configState?.config?.topicsModelId ?? '';
  const savedDraftModel = configState?.config?.draftModelId ?? '';
  const effectiveTopics = topicsModelId || savedTopicsModel;
  const effectiveDraft = draftModelId || savedDraftModel;

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
            </div>
          </div>
          <StatusBadge status={configState?.status ?? 'not-configured'} />
        </div>

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
          <div>
            <h2 className="text-sm font-semibold text-zinc-200 mb-0.5">Modelos ativos</h2>
            <p className="text-xs text-zinc-500">
              Selecione modelos do catálogo OpenRouter que suportam saída estruturada.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ModelSelector
              label="Modelo de tópicos"
              value={effectiveTopics}
              onChange={setTopicsModelId}
              searchQuery={topicsSearch}
              onSearchChange={setTopicsSearch}
              models={topicsModelsQuery.data?.data ?? []}
              isLoadingModels={topicsModelsQuery.isLoading}
            />

            <ModelSelector
              label="Modelo de rascunho"
              value={effectiveDraft}
              onChange={setDraftModelId}
              searchQuery={draftSearch}
              onSearchChange={setDraftSearch}
              models={draftModelsQuery.data?.data ?? []}
              isLoadingModels={draftModelsQuery.isLoading}
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Os modelos são validados contra o catálogo ao salvar.
            </p>
            <Button
              onClick={handleSave}
              disabled={isSaving || !effectiveTopics || !effectiveDraft}
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
