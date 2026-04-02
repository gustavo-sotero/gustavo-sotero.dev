'use client';

import type { Project } from '@portfolio/shared';
import { ArrowRight, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface FeaturedProjectsProps {
  projects: Project[];
}

export function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  return (
    <BlurFade direction="up" duration={0.5} inView className="space-y-8">
      {/* Section header */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">portfolio</p>
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Projetos</h2>
        </div>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-emerald-400 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          Ver todos os projetos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Em mobile: overflow-hidden evita scroll horizontal (botões hidden).
          Em sm+: px-12 cria espaço lateral para os botões prev/next absolutamente
          posicionados em -left-12/-right-12, mantendo-os fora da área dos cards. */}
      <div className="overflow-hidden sm:overflow-visible sm:px-12">
        <Carousel opts={{ align: 'start', loop: false }} aria-label="Projetos" className="w-full">
          <CarouselContent>
            {projects.map((project) => (
              <CarouselItem key={project.id} className="pl-4 basis-[88%] sm:basis-1/2 lg:basis-1/3">
                <ProjectCard project={project} />
              </CarouselItem>
            ))}

            {/* CTA slide — always last */}
            <CarouselItem className="pl-4 basis-[88%] sm:basis-1/2 lg:basis-1/3">
              <Link
                href="/projects"
                className="group flex h-full min-h-70 flex-col items-center justify-center gap-4 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/50 hover:bg-zinc-900/60 hover:shadow-lg hover:shadow-emerald-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                aria-label="Ver todos os projetos"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/60 transition-colors group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10">
                  <FolderOpen className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-emerald-400" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-semibold text-zinc-200 transition-colors group-hover:text-emerald-400">
                    Ver todos os projetos
                  </p>
                  <p className="text-sm text-zinc-400">Explore o portfólio completo</p>
                </div>
                <span
                  className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                >
                  Explorar <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </CarouselItem>
          </CarouselContent>

          <CarouselPrevious
            className="hidden sm:flex border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 hover:border-emerald-500/50 disabled:opacity-30"
            aria-label="Slide anterior"
          />
          <CarouselNext
            className="hidden sm:flex border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 hover:border-emerald-500/50 disabled:opacity-30"
            aria-label="Próximo slide"
          />
        </Carousel>
      </div>
    </BlurFade>
  );
}
