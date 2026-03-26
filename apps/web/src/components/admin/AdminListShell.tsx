'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── Shared status badge ───────────────────────────────────────────────────────

/**
 * Status badge for admin CRUD listings.
 * Handles: published (emerald), scheduled (amber), draft (zinc).
 */
export function AdminStatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        Publicado
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
        Agendado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-zinc-700/50 text-zinc-400 border-zinc-600/30">
      Rascunho
    </span>
  );
}

// ── Shared table row skeleton ─────────────────────────────────────────────────

export function AdminRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-800">
      <Skeleton className="h-4 flex-1 bg-zinc-800" />
      <Skeleton className="h-5 w-20 bg-zinc-800 rounded-full" />
      <Skeleton className="h-7 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

// ── AdminListShell ────────────────────────────────────────────────────────────

interface AdminListShellProps {
  /** Page title (h1). */
  title: string;
  /** Subtitle line below title (e.g. total count). Omit to hide. */
  subtitle?: string;
  /** Controls mounted to the right of the title (filter selects and New button). */
  headerRight?: ReactNode;
  /** Column header row rendered inside the table container. Should carry its own
   *  grid-cols and border-b classes to match the data rows. */
  tableHeader: ReactNode;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  /** Icon shown in the empty state (e.g. a lucide icon element). */
  emptyIcon?: ReactNode;
  emptyMessage: string;
  /** Optional CTA shown below the empty message. */
  emptyAction?: ReactNode;
  /** Number of skeleton rows to render while loading. Defaults to 6. */
  skeletonCount?: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Data rows — rendered only when not loading, not errored and not empty. */
  children: ReactNode;
}

export function AdminListShell({
  title,
  subtitle,
  headerRight,
  tableHeader,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyMessage,
  emptyAction,
  skeletonCount = 6,
  page,
  totalPages,
  onPageChange,
  children,
}: AdminListShellProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {tableHeader}

        {/* Loading */}
        {/* biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows are static placeholders with no stable identity */}
        {isLoading && Array.from({ length: skeletonCount }, (_, i) => <AdminRowSkeleton key={i} />)}

        {/* Error */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-zinc-500">Falha ao carregar dados</p>
            <Button size="sm" variant="ghost" onClick={onRetry} className="text-xs text-zinc-400">
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && isEmpty && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            {emptyIcon}
            <p className="text-sm text-zinc-500">{emptyMessage}</p>
            {emptyAction}
          </div>
        )}

        {/* Rows */}
        {!isLoading && !isError && !isEmpty && children}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-400"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-400"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
