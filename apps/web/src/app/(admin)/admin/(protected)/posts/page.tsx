'use client';

import type { Post, PostStatus } from '@portfolio/shared';
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { useAdminPosts, useDeletePost } from '@/hooks/use-admin-queries';

function StatusBadge({ status }: { status: string }) {
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

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-800">
      <Skeleton className="h-4 flex-1 bg-zinc-800" />
      <Skeleton className="h-5 w-20 bg-zinc-800 rounded-full" />
      <Skeleton className="h-4 w-24 bg-zinc-800" />
      <Skeleton className="h-7 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

export default function AdminPostsPage() {
  const [status, setStatus] = useState<PostStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const { data, isLoading, isError, refetch } = useAdminPosts({
    page,
    perPage,
    status: status === 'all' ? undefined : status,
  });
  const deletePost = useDeletePost();

  const posts: Post[] = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Posts</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {meta ? `${meta.total} post${meta.total !== 1 ? 's' : ''}` : ' '}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as PostStatus | 'all');
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
              <SelectItem value="scheduled" className="text-xs text-amber-400 focus:bg-zinc-800">
                Agendados
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
            <Link href="/admin/posts/new">
              <Plus className="h-3.5 w-3.5" />
              Novo Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {/* Col headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Título</span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-24 text-center">
            Status
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-32 text-center">
            Data
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-20 text-right">
            Ações
          </span>
        </div>

        {isLoading ? (
          (['rs1', 'rs2', 'rs3', 'rs4', 'rs5', 'rs6', 'rs7', 'rs8'] as const).map((sk) => (
            <RowSkeleton key={sk} />
          ))
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-zinc-500">Falha ao carregar posts</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-xs text-zinc-400"
            >
              Tentar novamente
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <FileText className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhum post encontrado</p>
            <Button
              asChild
              size="sm"
              className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Link href="/admin/posts/new">
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro post
              </Link>
            </Button>
          </div>
        ) : (
          posts.map((post: Post) => (
            <div
              key={post.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80 transition-colors"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-zinc-200 truncate">{post.title}</p>
                <p className="text-xs font-mono text-zinc-600 truncate">{post.slug}</p>
              </div>
              <div className="w-24 flex justify-center">
                <StatusBadge status={post.status} />
              </div>
              <div className="w-32 text-center text-xs text-zinc-500">
                {post.status === 'scheduled' && post.scheduledAt ? (
                  <span className="text-amber-400/80">
                    {new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(post.scheduledAt))}
                  </span>
                ) : post.publishedAt ? (
                  new Intl.DateTimeFormat('pt-BR').format(new Date(post.publishedAt))
                ) : (
                  '—'
                )}
              </div>
              <div className="w-20 flex items-center justify-end gap-1">
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                >
                  <Link href={`/admin/posts/${post.slug}/edit`}>
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
                      <AlertDialogTitle className="text-zinc-100">Excluir post?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        <strong className="text-zinc-300">{post.title}</strong> será movido para a
                        lixeira. Esta ação pode ser desfeita manualmente no banco.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => deletePost.mutate({ id: post.id, slug: post.slug })}
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
