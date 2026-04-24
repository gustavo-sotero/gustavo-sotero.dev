import { Clock, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PostCard } from '@/components/blog/PostCard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getBlogTags } from '@/lib/data/public/home';
import { getPublicPosts } from '@/lib/data/public/posts';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Artigos sobre engenharia de software, backend, TypeScript e infraestrutura por Gustavo Sotero.',
};

// ─── Sort helpers ──────────────────────────────────────────────────────────────

/** Supported URL sort values. */
type BlogSortMode = 'relevancia' | 'recentes';

/** Coerce raw query param into a valid BlogSortMode (default: recentes). */
function normalizeBlogSortMode(raw?: string): BlogSortMode {
  return raw === 'relevancia' ? 'relevancia' : 'recentes';
}

/** Translate URL sort mode to API sort contract. */
function toApiSort(mode: BlogSortMode): 'manual' | 'recent' {
  return mode === 'relevancia' ? 'manual' : 'recent';
}

/** Build the canonical query-string for internal blog navigation links. */
function buildBlogQs(params: { page?: number; tag?: string; sort?: BlogSortMode }): string {
  const qs = new URLSearchParams();
  if (params.tag) qs.set('tag', params.tag);
  // omit `sort` when it equals the default to keep URLs clean
  if (params.sort && params.sort !== 'recentes') qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  const str = qs.toString();
  return str ? `?${str}` : '';
}

// ─── Page helpers ──────────────────────────────────────────────────────────────

interface BlogPageProps {
  searchParams: Promise<{ page?: string; tag?: string; sort?: string }>;
}

function normalizePage(rawPage?: string): number {
  const parsed = Number(rawPage ?? '1');
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

// ─── Sort toggle ───────────────────────────────────────────────────────────────

interface SortToggleProps {
  currentSort: BlogSortMode;
  tag?: string;
}

/**
 * Single toggle button: shows the current sort mode and links to the opposite.
 * Switching sort always resets to page 1 to avoid stale pagination state.
 * Tag filter is preserved across sort changes.
 */
function SortToggle({ currentSort, tag }: SortToggleProps) {
  const isRelevancia = currentSort === 'relevancia';
  const nextSort: BlogSortMode = isRelevancia ? 'recentes' : 'relevancia';
  const Icon = isRelevancia ? Star : Clock;
  const label = isRelevancia ? 'Relevância' : 'Recentes';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 font-mono hidden sm:block">ordenar por</span>
      <Link
        href={`/blog${buildBlogQs({ tag, sort: nextSort })}`}
        title={`Ordenação atual: ${label} — clique para alternar`}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
          isRelevancia
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300',
        ].join(' ')}
      >
        <Icon size={12} className={isRelevancia ? 'fill-emerald-400' : ''} aria-hidden="true" />
        {label}
      </Link>
    </div>
  );
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

export interface BlogContentProps {
  currentPage: number;
  tag?: string;
  sort: BlogSortMode;
}

export async function BlogContent({ currentPage, tag, sort }: BlogContentProps) {
  const [postsResult, tagsResult] = await Promise.all([
    getPublicPosts({ page: currentPage, tag, sort: toApiSort(sort) }),
    getBlogTags(),
  ]);

  if (postsResult.state === 'degraded') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-zinc-500 font-mono text-sm">
          {'// serviço temporariamente indisponível'}
        </p>
        <p className="text-zinc-600 text-sm">Tente novamente em alguns instantes.</p>
      </div>
    );
  }

  const posts = postsResult.data;
  const meta = postsResult.meta;
  const tags = tagsResult.state !== 'degraded' ? tagsResult.data : [];

  return (
    <>
      {/* ── Header row ───────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">artigos</p>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">Blog</h1>
          {meta && (
            <p className="text-zinc-500 text-sm">
              {meta.total} {meta.total === 1 ? 'artigo publicado' : 'artigos publicados'}
            </p>
          )}
        </div>

        <SortToggle currentSort={sort} tag={tag} />
      </div>

      {/* ── Tag filter ──────────────────────────────────────── */}
      {tags.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filtrar por tag">
          <Link href={`/blog${buildBlogQs({ sort })}`}>
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
            <Link key={t.id} href={`/blog${buildBlogQs({ tag: t.slug, sort })}`}>
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

      {/* ── Grid ────────────────────────────────────────────── */}
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
              href={`/blog${buildBlogQs({ sort })}`}
              className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Limpar filtro
            </Link>
          )}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {meta && meta.totalPages > 1 && (
        <nav
          aria-label="Paginação do blog"
          className="mt-12 flex items-center justify-center gap-2"
        >
          {currentPage > 1 && (
            <Link
              href={`/blog${buildBlogQs({ tag, sort, page: currentPage - 1 })}`}
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
                href={`/blog${buildBlogQs({ tag, sort, page: p })}`}
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
              href={`/blog${buildBlogQs({ tag, sort, page: currentPage + 1 })}`}
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

export default function BlogPage({ searchParams }: BlogPageProps) {
  return (
    <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      <Suspense fallback={<BlogPageFallback />}>
        <BlogContentLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * Thin async wrapper that resolves searchParams inside the Suspense boundary,
 * then delegates to BlogContent with the parsed values.  Keeps all dynamic
 * data access (searchParams + network fetches) inside Suspense so that
 * cacheComponents can prerender the static shell without blocking.
 */
async function BlogContentLoader({ searchParams }: BlogPageProps) {
  const { page: rawPage, tag, sort: rawSort } = await searchParams;
  const currentPage = normalizePage(rawPage);
  const sort = normalizeBlogSortMode(rawSort);
  return <BlogContent currentPage={currentPage} tag={tag} sort={sort} />;
}
