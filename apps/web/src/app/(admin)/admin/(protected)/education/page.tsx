'use client';

import type { Education } from '@portfolio/shared/types/education';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AdminListShell, AdminStatusBadge } from '@/components/admin/AdminListShell';
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
import { useAdminEducation, useDeleteEducation } from '@/hooks/admin/use-admin-education';

export default function AdminEducationPage() {
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const { data, isLoading, isError, refetch } = useAdminEducation({
    page,
    perPage,
    status: status === 'all' ? undefined : status,
  });
  const deleteEdu = useDeleteEducation();

  const items: Education[] = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <AdminListShell
      title="Formação"
      subtitle={meta ? `${meta.total} entrada${meta.total !== 1 ? 's' : ''}` : ' '}
      headerRight={
        <>
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
            <Link href="/admin/education/new">
              <Plus className="h-3.5 w-3.5" />
              Nova Formação
            </Link>
          </Button>
        </>
      }
      tableHeader={
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Título / Instituição
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
      }
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      isEmpty={items.length === 0}
      skeletonCount={5}
      emptyIcon={<GraduationCap className="h-8 w-8 text-zinc-700" />}
      emptyMessage="Nenhuma formação cadastrada"
      emptyAction={
        <Button
          asChild
          size="sm"
          className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Link href="/admin/education/new">
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Link>
        </Button>
      }
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
    >
      {items.map((item: Education) => (
        <div
          key={item.id}
          className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80 transition-colors"
        >
          <div className="min-w-0 pr-4">
            <p className="text-sm font-medium text-zinc-200 truncate">{item.title}</p>
            <p className="text-xs text-zinc-500 truncate">{item.institution}</p>
          </div>
          <div className="w-24 flex justify-center">
            <AdminStatusBadge status={item.status} />
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
              <Link href={`/admin/education/${item.slug}/edit`}>
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
                  <AlertDialogTitle className="text-zinc-100">Excluir formação?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    <strong className="text-zinc-300">{item.title}</strong> em {item.institution}{' '}
                    será removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => deleteEdu.mutate(item.id)}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </AdminListShell>
  );
}
