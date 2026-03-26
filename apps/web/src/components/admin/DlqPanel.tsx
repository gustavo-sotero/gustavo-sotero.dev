'use client';

import { AlertTriangle, CheckCircle2, RefreshCw, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DlqQueue } from '@/hooks/admin/use-admin-dlq';
import { useDlq } from '@/hooks/admin/use-admin-dlq';

const QUEUE_LABELS: Record<string, string> = {
  'telegram-notifications-dlq': 'Notificações Telegram',
  'image-optimize-dlq': 'Otimização de Imagens',
};

function QueueRow({ name, count }: { name: string; count: number }) {
  const label = QUEUE_LABELS[name] ?? name;
  const hasFailures = count > 0;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-2.5">
        {hasFailures ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-xs font-mono text-zinc-600">{name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums min-w-8 ${
            hasFailures
              ? 'bg-red-500/15 text-red-400 border border-red-500/20'
              : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          {count}
        </span>
        {hasFailures && (
          <span className="text-xs text-red-400/80">{count === 1 ? 'falha' : 'falhas'}</span>
        )}
      </div>
    </div>
  );
}

function DlqSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {(['q1', 'q2'] as const).map((sk) => (
        <div
          key={sk}
          className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0"
        >
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6 rounded-full bg-zinc-800" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40 bg-zinc-800" />
              <Skeleton className="h-3 w-52 bg-zinc-800" />
            </div>
          </div>
          <Skeleton className="h-5 w-8 rounded-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function DlqPanel() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useDlq();

  const queues: DlqQueue[] = data?.queues ?? [];
  const totalFailures = data?.totalFailed ?? 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ServerCrash className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Dead Letter Queues</span>
          {!isLoading && !isError && totalFailures > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-500/15 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
              {totalFailures}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-zinc-600">
              última atualização:{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <DlqSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 py-8 text-center">
          <p className="text-sm text-zinc-500">Falha ao verificar filas</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="text-xs text-zinc-400"
          >
            Tentar novamente
          </Button>
        </div>
      ) : queues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-zinc-400">Nenhuma fila DLQ reportada</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {queues.map((q) => (
            <QueueRow key={q.name} name={q.name} count={q.total} />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600">Auto-atualiza a cada 30s</p>
    </div>
  );
}
