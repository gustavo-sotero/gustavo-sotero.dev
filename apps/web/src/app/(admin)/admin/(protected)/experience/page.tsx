'use client';

import type { Experience } from '@portfolio/shared';
import { Briefcase, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminExperience, useDeleteExperience } from '@/hooks/use-admin-queries';

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        status === 'published'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
      }`}
    >
      {status === 'published' ? 'Publicado' : 'Rascunho'}
    </span>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-800">
      <Skeleton className="h-4 flex-1 bg-zinc-800" />
      <Skeleton className="h-5 w-20 bg-zinc-800 rounded-full" />
      <Skeleton className="h-7 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

export default function AdminExperiencePage() {
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const { data, isLoading, isError, refetch } = useAdminExperience({
    page,
    perPage,
    status: status === 'all' ? undefined : status,
  });
  const deleteExp = useDeleteExperience();

  const items: Experience[] = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Experiência</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {meta ? `${meta.total} entrada${meta.total !== 1 ? 's' : ''}` : ' '}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as 'all' | 'draft' | 'published');
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-35 border-zinc-700 bg-zinc-900 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-xs focus:bg-zinc-800">
                Todos
              </SelectItem>
              <SelectItem value="published" className="text-xs text-emerald-400 focus:bg-zinc-800">
                Publicados
              </SelectItem>
              <SelectItem value="draft" className="text-xs text-zinc-400 focus:bg-zinc-800">
                Rascunhos
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            asChild
            size="sm"
            className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Link href="/admin/experience/new">
              <Plus className="h-3.5 w-3.5" />
              Nova Experiência
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Cargo / Empresa
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-24 text-center">
            Status
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-12 text-center">
            Ord.
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-20 text-right">
            Ações
          </span>
        </div>

        {isLoading ? (
          (['rk0', 'rk1', 'rk2', 'rk3', 'rk4'] as const).map((sk) => <RowSkeleton key={sk} />)
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-zinc-500">Falha ao carregar</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-xs text-zinc-400"
            >
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Briefcase className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhuma experiência cadastrada</p>
            <Button
              asChild
              size="sm"
              className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Link href="/admin/experience/new">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Link>
            </Button>
          </div>
        ) : (
          items.map((item: Experience) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80 transition-colors"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-zinc-200 truncate">{item.role}</p>
                <p className="text-xs text-zinc-500 truncate">{item.company}</p>
              </div>
              <div className="w-24 flex justify-center">
                <StatusBadge status={item.status} />
              </div>
              <div className="w-12 text-center text-sm font-mono text-zinc-500">
                {item.order ?? '—'}
              </div>
              <div className="w-20 flex items-center justify-end gap-1">
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                >
                  <Link href={`/admin/experience/${item.slug}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-100">
                        Excluir experiência?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        <strong className="text-zinc-300">{item.role}</strong> na {item.company}{' '}
                        será removido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => deleteExp.mutate(item.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>

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
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-400"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
