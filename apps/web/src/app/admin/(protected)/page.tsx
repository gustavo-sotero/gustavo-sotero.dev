'use client';

import { Calendar, Eye, FileText, FolderGit2, MessageSquare, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { TopPostsChart } from '@/components/admin/AnalyticsChart';
import { DlqPanel } from '@/components/admin/DlqPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsSummary, useAnalyticsTopPosts } from '@/hooks/use-admin-queries';

function MetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
  accent,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 flex items-center gap-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent} shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-16 bg-zinc-800" />
        ) : (
          <p className="text-2xl font-bold text-zinc-100 tabular-nums">
            {value?.toLocaleString('pt-BR') ?? '—'}
          </p>
        )}
      </div>
    </div>
  );
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState(defaultDateRange);

  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useAnalyticsSummary({ from: range.from, to: range.to });
  const {
    data: topPostsData,
    isLoading: topPostsLoading,
    isError: topPostsError,
    refetch: refetchTopPosts,
  } = useAnalyticsTopPosts({ from: range.from, to: range.to, limit: 8 });

  const summary = summaryData;
  const topPosts = topPostsData ?? [];
  const hasSummaryData = Boolean(
    summary &&
      (summary.pageviews > 0 ||
        summary.pendingComments > 0 ||
        summary.publishedPosts > 0 ||
        summary.publishedProjects > 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Visão geral do portfólio</p>
        </div>

        {/* Date range pickers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            <Label htmlFor="from-date" className="text-xs text-zinc-500 sr-only">
              De
            </Label>
            <Input
              id="from-date"
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="h-7 w-36 text-xs border-zinc-700 bg-zinc-900 text-zinc-300 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-zinc-600">até</span>
          <Input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="h-7 w-36 text-xs border-zinc-700 bg-zinc-900 text-zinc-300 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Pageviews (período)"
          value={summary?.pageviews}
          icon={Eye}
          isLoading={summaryLoading}
          accent="bg-blue-500/10 text-blue-400"
        />
        <MetricCard
          label="Comentários pendentes"
          value={summary?.pendingComments}
          icon={MessageSquare}
          isLoading={summaryLoading}
          accent="bg-amber-500/10 text-amber-400"
        />
        <MetricCard
          label="Posts publicados"
          value={summary?.publishedPosts}
          icon={FileText}
          isLoading={summaryLoading}
          accent="bg-emerald-500/10 text-emerald-400"
        />
        <MetricCard
          label="Projetos publicados"
          value={summary?.publishedProjects}
          icon={FolderGit2}
          isLoading={summaryLoading}
          accent="bg-violet-500/10 text-violet-400"
        />
      </div>

      {summaryError && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">Falha ao carregar métricas do período.</p>
          <button
            type="button"
            onClick={() => refetchSummary()}
            className="text-xs text-zinc-300 hover:text-zinc-100"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!summaryLoading && !summaryError && !hasSummaryData && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="text-sm text-zinc-500">Sem dados no período selecionado.</p>
        </div>
      )}

      {/* Charts + DLQ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top posts */}
        <div className="lg:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-300">Top Posts por Visualizações</h2>
          </div>
          {topPostsError ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-zinc-500">Falha ao carregar top posts</p>
              <button
                type="button"
                onClick={() => refetchTopPosts()}
                className="text-xs text-zinc-300 hover:text-zinc-100"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <TopPostsChart data={topPosts} isLoading={topPostsLoading} />
          )}
        </div>

        {/* DLQ */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <DlqPanel />
        </div>
      </div>

      {!topPostsLoading && topPosts.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Caminho
            </span>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-24 text-right">
              Views
            </span>
          </div>
          {topPosts.map((item: { path: string; views: number }) => (
            <div
              key={item.path}
              className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80"
            >
              <span className="text-sm font-mono text-zinc-400 truncate">{item.path}</span>
              <span className="text-sm font-bold text-zinc-200 tabular-nums w-24 text-right">
                {item.views.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
