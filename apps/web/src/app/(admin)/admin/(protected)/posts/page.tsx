'use client';

import type { Post, PostStatus } from '@portfolio/shared';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { useAdminPosts, useDeletePost } from '@/hooks/admin/use-admin-posts';

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
    <AdminListShell
      title="Posts"
      subtitle={meta ? `${meta.total} post${meta.total !== 1 ? 's' : ''}` : ' '}
      headerRight={
        <>
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
        </>
      }
      tableHeader={
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Título</span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide w-16 text-center">
            Ordem
          </span>
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
      }
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      isEmpty={posts.length === 0}
      emptyIcon={<FileText className="h-8 w-8 text-zinc-700" />}
      emptyMessage="Nenhum post encontrado"
      emptyAction={
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
      }
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
    >
      {posts.map((post: Post) => (
        <div
          key={post.id}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80 transition-colors"
        >
          <div className="min-w-0 pr-4">
            <p className="text-sm font-medium text-zinc-200 truncate">{post.title}</p>
            <p className="text-xs font-mono text-zinc-600 truncate">{post.slug}</p>
          </div>
          <div className="w-16 flex justify-center">
            <span className="text-xs font-mono text-zinc-500">{post.order}</span>
          </div>
          <div className="w-24 flex justify-center">
            <AdminStatusBadge status={post.status} />
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
      ))}
    </AdminListShell>
  );
}
