'use client';

import type { Project } from '@portfolio/shared';
import { ExternalLink, Github, Globe, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { Badge } from '@/components/ui/badge';
import { BorderBeam } from '@/components/ui/border-beam';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const tags = [...(project.tags ?? [])].sort(
    (a, b) => Number(b.isHighlighted) - Number(a.isHighlighted)
  );

  return (
    <div className="group relative flex flex-col glass-card rounded-xl overflow-hidden hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/8 transition-all duration-300">
      {/* Stretched link — covers entire card, below action buttons */}
      <Link
        href={`/projects/${project.slug}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-xl"
        aria-label={`Ver projeto ${project.title}`}
      />
      <BorderBeam colorFrom="#34d399" colorTo="#22d3ee" duration={4} size={120} />
      {/* Featured badge */}
      {project.featured && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
          <Star className="h-2.5 w-2.5 fill-current" />
          <span>Destaque</span>
        </div>
      )}

      {/* Cover image */}
      <div className="relative h-48 w-full bg-zinc-800/60 overflow-hidden">
        {project.coverUrl ? (
          <Image
            src={project.coverUrl}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-zinc-800 via-zinc-850 to-zinc-900 flex items-center justify-center">
            <div className="font-mono text-zinc-700 text-xs opacity-50 select-none text-center px-4">
              <div>{'{ project }'}</div>
              <div className="mt-1 text-zinc-800">{project.slug}</div>
            </div>
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-zinc-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-3">
          <ExternalLink className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Title */}
        <h3 className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors duration-200 leading-snug">
          {project.title}
        </h3>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed flex-1">
            {project.description}
          </p>
        )}

        {/* Tags + Links — pinned to bottom */}
        {(tags.length > 0 || project.repositoryUrl || project.liveUrl) && (
          <div className="flex flex-col gap-2 mt-auto">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/60">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className={cn(
                      'text-xs border',
                      tag.isHighlighted
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                    )}
                  >
                    {tag.isHighlighted && (
                      <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 mr-1 inline-block flex-shrink-0" />
                    )}
                    {tag.isHighlighted ? (
                      <AnimatedShinyText
                        shimmerWidth={60}
                        className="text-emerald-300! dark:text-emerald-300!"
                      >
                        {tag.name}
                      </AnimatedShinyText>
                    ) : (
                      tag.name
                    )}
                  </Badge>
                ))}
              </div>
            )}

            {/* Repo & Live links */}
            {(project.repositoryUrl || project.liveUrl) && (
              <div className="relative z-10 flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                {project.repositoryUrl && (
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 hover:border-zinc-600 rounded-md px-2.5 py-1.5 transition-all duration-200"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span>Repo</span>
                  </a>
                )}
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-md px-2.5 py-1.5 transition-all duration-200"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Ao vivo</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
