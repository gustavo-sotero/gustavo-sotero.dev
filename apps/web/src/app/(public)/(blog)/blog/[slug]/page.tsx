import type { PublicCommentNode } from '@portfolio/shared/types/comments';
import { Calendar, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { CommentsSection } from '@/components/blog/CommentsSection';
import { JsonLdScript } from '@/components/shared/JsonLdScript';
import { MermaidRenderer } from '@/components/shared/MermaidRenderer';
import { PublicPageUnavailable } from '@/components/shared/PublicPageUnavailable';
import { TechIcon } from '@/components/shared/TechIcon';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SITE_METADATA } from '@/lib/constants';
import { getPublicPostDetail } from '@/lib/data/public/posts';
import { formatDateBR } from '@/lib/utils';

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicPostDetail(slug);

  if (result.state === 'not-found') return { title: 'Post não encontrado' };
  if (result.state === 'degraded') {
    return {
      title: 'Post temporariamente indisponível',
      description: 'O conteúdo não pôde ser carregado no momento.',
    };
  }

  const post = result.data;

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverUrl ? [{ url: post.coverUrl }] : [],
      type: 'article',
      publishedTime: post.publishedAt ?? post.createdAt,
      modifiedTime: post.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverUrl ? [post.coverUrl] : [],
    },
  };
}

/** Estimate reading time based on word count (~200 wpm) */
function readingTime(content?: string | null): string {
  if (!content) return '1 min de leitura';
  const words = content.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min de leitura`;
}

export async function BlogDetailContent({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicPostDetail(slug);

  if (result.state === 'not-found') notFound();

  if (result.state === 'degraded') {
    return (
      <PublicPageUnavailable
        title="Post temporariamente indisponível"
        description="A API pública não respondeu a tempo. Tente novamente em alguns instantes."
        backHref="/blog"
        backLabel="Voltar para o blog"
      />
    );
  }

  const post = result.data;

  const tags = post.tags ?? [];
  // The API returns only approved non-deleted comments as a nested tree (initial preview ≤30).
  const approvedComments: PublicCommentNode[] = post.comments ?? [];
  const hasMermaid = post.renderedContent?.includes('class="mermaid"') ?? false;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.coverUrl,
    author: {
      '@type': 'Person',
      name: 'Gustavo Sotero',
    },
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    url: `${SITE_METADATA.url}/blog/${post.slug}`,
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <article className="container mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
        {/* Cover */}
        {post.coverUrl && (
          <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden mb-10 ring-1 ring-zinc-800">
            <Image src={post.coverUrl} alt={post.title} fill priority className="object-cover" />
          </div>
        )}

        {/* Header */}
        <header className="mb-8 space-y-4">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="gap-1.5 text-xs font-mono border transition-colors border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-zinc-100"
                >
                  <TechIcon
                    iconKey={tag.iconKey}
                    category={tag.category}
                    name={tag.name}
                    size={12}
                  />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight">
            {post.title}
          </h1>

          {post.excerpt && <p className="text-zinc-400 text-lg leading-relaxed">{post.excerpt}</p>}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <time dateTime={post.publishedAt ?? post.createdAt}>
                {formatDateBR(post.publishedAt ?? post.createdAt)}
              </time>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {readingTime(post.content)}
            </span>
          </div>
        </header>

        {/* Content — MermaidRenderer if needed, plain dangerouslySetInnerHTML otherwise */}
        {hasMermaid ? (
          <MermaidRenderer html={post.renderedContent ?? ''} />
        ) : (
          <TrustedHtml
            html={post.renderedContent ?? ''}
            className="prose prose-zinc dark:prose-invert max-w-none prose-portfolio"
          />
        )}

        {/* Comments section */}
        <Separator className="my-12 bg-zinc-800" />

        <CommentsSection
          postId={post.id}
          postSlug={post.slug}
          initialComments={approvedComments}
          commentCount={post.commentCount}
        />
      </article>
    </>
  );
}

/**
 * Request-bound page: calls connection() to opt out of PPR/prerender entirely,
 * then renders BlogDetailContent directly (no inline Suspense).  This ensures
 * the full page — including the degraded-state fallback — is rendered
 * server-side before the first byte is sent, eliminating the streaming-
 * dependent rendering path that can be disrupted by proxy middleware (e.g.
 * Cloudflare Rocket Loader) reordering inline scripts.  A route-level
 * loading.tsx still provides the navigation skeleton via Next.js's built-in
 * Suspense wrapper around the page segment.
 */
export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  await connection();
  return <BlogDetailContent params={params} />;
}
