import type { PublicCommentNode } from '@portfolio/shared';
import { Calendar, Clock, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CommentsSection } from '@/components/blog/CommentsSection';
import { JsonLdScript } from '@/components/shared/JsonLdScript';
import { MermaidRenderer } from '@/components/shared/MermaidRenderer';
import { TechIcon } from '@/components/shared/TechIcon';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getPublicPost, getPublishedPostSlugs } from '@/lib/data/public/posts';
import { env } from '@/lib/env';
import { cn, formatDateBR } from '@/lib/utils';

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) return { title: 'Post não encontrado' };

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

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = await getPublicPost(slug);

  if (!post) notFound();

  const tags = [...(post.tags ?? [])].sort(
    (a, b) => Number(b.isHighlighted) - Number(a.isHighlighted)
  );
  // The API returns only approved non-deleted comments as a nested tree.
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
    url: `${env.NEXT_PUBLIC_API_URL?.replace('api.', '')}/blog/${post.slug}`,
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <article className="container mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
        {/* Cover */}
        {post.coverUrl && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-10 ring-1 ring-zinc-800">
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
                  className={cn(
                    'gap-1.5 text-xs font-mono border transition-colors',
                    tag.isHighlighted
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50 hover:text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-zinc-100'
                  )}
                >
                  {tag.isHighlighted && (
                    <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
                  )}
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

        <CommentsSection postId={post.id} initialComments={approvedComments} />
      </article>
    </>
  );
}
