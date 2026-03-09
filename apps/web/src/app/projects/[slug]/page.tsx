import type { Tag } from '@portfolio/shared';
import { ExternalLink, Github, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { JsonLdScript } from '@/components/shared/JsonLdScript';
import { TechIcon } from '@/components/shared/TechIcon';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPublicProject, getPublishedProjectSlugs } from '@/lib/data/public/projects';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPublishedProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) return { title: 'Projeto não encontrado' };

  return {
    title: project.title,
    description: project.description ?? undefined,
    openGraph: {
      title: project.title,
      description: project.description ?? undefined,
      images: project.coverUrl ? [{ url: project.coverUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description ?? undefined,
      images: project.coverUrl ? [project.coverUrl] : [],
    },
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const project = await getPublicProject(slug);

  if (!project) notFound();

  const tags = [...((project as typeof project & { tags?: Tag[] }).tags ?? [])].sort(
    (a, b) => Number(b.isHighlighted) - Number(a.isHighlighted)
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.description,
    url: `${env.NEXT_PUBLIC_API_URL?.replace('api.', '')}/projects/${project.slug}`,
    author: {
      '@type': 'Person',
      name: 'Gustavo Sotero',
    },
    image: project.coverUrl,
    datePublished: project.createdAt,
    dateModified: project.updatedAt,
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <article className="container mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
        {/* Cover */}
        {project.coverUrl && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-10 ring-1 ring-zinc-800">
            <Image
              src={project.coverUrl}
              alt={project.title}
              fill
              priority
              className="object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8 space-y-4">
          {project.featured && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono">
              ★ Destaque
            </Badge>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight">
            {project.title}
          </h1>

          {project.description && (
            <p className="text-zinc-400 text-lg leading-relaxed">{project.description}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className={cn(
                    'gap-1.5 text-xs font-mono border transition-colors',
                    tag.isHighlighted
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/50 hover:text-amber-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500/30 hover:text-zinc-100'
                  )}
                >
                  {tag.isHighlighted && (
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                  <TechIcon iconKey={tag.iconKey} category={tag.category} size={12} />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-3 pt-2">
            {project.repositoryUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 text-zinc-300 hover:border-emerald-500/40 hover:text-zinc-100"
              >
                <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                  Repositório
                </a>
              </Button>
            )}
            {project.liveUrl && (
              <Button
                asChild
                size="sm"
                className="gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              >
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver ao vivo
                </a>
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        {project.renderedContent && (
          <TrustedHtml
            html={project.renderedContent}
            className="prose prose-zinc dark:prose-invert max-w-none prose-portfolio"
          />
        )}
      </article>
    </>
  );
}
