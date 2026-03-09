import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PostCard } from '@/components/blog/PostCard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getHomeTags } from '@/lib/data/public/home';
import { getPublicPosts } from '@/lib/data/public/posts';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Artigos sobre engenharia de software, backend, TypeScript e infraestrutura por Gustavo Sotero.',
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

function normalizePage(rawPage?: string): number {
  const parsed = Number(rawPage ?? '1');
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function BlogPageFallback() {
  const chipSkeletonKeys = ['chip-1', 'chip-2', 'chip-3', 'chip-4', 'chip-5', 'chip-6'];
  const cardSkeletonKeys = ['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6'];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-wrap gap-2">
        {chipSkeletonKeys.map((key) => (
          <Skeleton key={key} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cardSkeletonKeys.map((key) => (
          <Skeleton key={key} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

interface BlogContentProps {
  currentPage: number;
  tag?: string;
}

async function BlogContent({ currentPage, tag }: BlogContentProps) {
  const [postsData, tagsResult] = await Promise.all([
    getPublicPosts({ page: currentPage, tag }),
    getHomeTags(),
  ]);

  const posts = postsData.data;
  const meta = postsData.meta;
  const tags = tagsResult.state !== 'degraded' ? tagsResult.data : [];

  return (
    <>
      <div className="mb-10 space-y-2">
        <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">artigos</p>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">Blog</h1>
        {meta && (
          <p className="text-zinc-500 text-sm">
            {meta.total} {meta.total === 1 ? 'artigo publicado' : 'artigos publicados'}
          </p>
        )}
      </div>
      {tags.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filtrar por tecnologia">
          <Link href="/blog">
            <Badge
              variant={!tag ? 'default' : 'secondary'}
              className={
                !tag
                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 cursor-pointer'
                  : 'cursor-pointer hover:border-emerald-500/40 hover:text-zinc-100 transition-colors'
              }
            >
              Todos
            </Badge>
          </Link>
          {tags.map((t) => (
            <Link key={t.id} href={`/blog?tag=${t.slug}`}>
              <Badge
                variant={tag === t.slug ? 'default' : 'secondary'}
                className={
                  tag === t.slug
                    ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 cursor-pointer'
                    : 'cursor-pointer hover:border-emerald-500/40 hover:text-zinc-100 transition-colors'
                }
              >
                {t.name}
              </Badge>
            </Link>
          ))}
        </nav>
      )}

      {posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-zinc-500 font-mono text-sm">{'// nenhum artigo encontrado'}</p>
          {tag && (
            <Link
              href="/blog"
              className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Limpar filtro
            </Link>
          )}
        </div>
      )}
      {meta && meta.totalPages > 1 && (
        <nav
          aria-label="Paginação do blog"
          className="mt-12 flex items-center justify-center gap-2"
        >
          {currentPage > 1 && (
            <Link
              href={`/blog?${tag ? `tag=${tag}&` : ''}page=${currentPage - 1}`}
              className="px-4 py-2 rounded-md text-sm border border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-zinc-100 transition-colors"
            >
              ← Anterior
            </Link>
          )}
          {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - currentPage) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={`/blog?${tag ? `tag=${tag}&` : ''}page=${p}`}
                aria-current={p === currentPage ? 'page' : undefined}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  p === currentPage
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'border border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-zinc-100'
                }`}
              >
                {p}
              </Link>
            ))}
          {currentPage < meta.totalPages && (
            <Link
              href={`/blog?${tag ? `tag=${tag}&` : ''}page=${currentPage + 1}`}
              className="px-4 py-2 rounded-md text-sm border border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-zinc-100 transition-colors"
            >
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { page: rawPage, tag } = await searchParams;
  const currentPage = normalizePage(rawPage);

  return (
    <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      <Suspense fallback={<BlogPageFallback />}>
        <BlogContent currentPage={currentPage} tag={tag} />
      </Suspense>
    </div>
  );
}
