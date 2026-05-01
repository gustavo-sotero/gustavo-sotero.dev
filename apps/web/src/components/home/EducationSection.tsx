'use client';

import type { Education } from '@portfolio/shared/types/education';
import { CalendarRange, ExternalLink, GraduationCap, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';

interface EducationSectionProps {
  education: Education[];
}

function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  isCurrent: boolean
): string {
  if (!startDate && !endDate) return '';

  const fmt = (d: string) => {
    const [year, month] = d.split('-');
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    return `${months[parseInt(month, 10) - 1]}. ${year}`;
  };

  if (isCurrent) {
    return startDate ? `${fmt(startDate)} — presente` : 'em andamento';
  }
  if (startDate && endDate) return `${fmt(startDate)} — ${fmt(endDate)}`;
  if (endDate) return fmt(endDate);
  return startDate ? fmt(startDate) : '';
}

function EducationCard({ item, index }: { item: Education; index: number }) {
  const period = formatPeriod(item.startDate, item.endDate, item.isCurrent);

  return (
    <BlurFade
      direction="up"
      duration={0.4}
      delay={index * 0.08}
      inView
      className="group relative flex gap-4 md:gap-6"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 group-hover:border-emerald-500/60 transition-colors duration-200">
          <GraduationCap className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors duration-200" />
        </div>
        <div className="mt-2 w-px flex-1 bg-zinc-800/70" />
      </div>

      {/* Content */}
      <div className="pb-10 min-w-0 flex-1">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm transition-colors duration-200 group-hover:border-zinc-700">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-100 text-base leading-snug">{item.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{item.institution}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              {item.isCurrent && (
                <Badge
                  variant="outline"
                  className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-xs"
                >
                  em andamento
                </Badge>
              )}
              {item.educationType && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
                  {item.educationType}
                </Badge>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 mb-3">
            {period && (
              <span className="flex items-center gap-1">
                <CalendarRange className="h-3 w-3" />
                {period}
              </span>
            )}
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.location}
              </span>
            )}
            {item.workloadHours && <span className="text-zinc-500">{item.workloadHours}h</span>}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 mb-3">
              {item.description}
            </p>
          )}

          {/* Credential link */}
          {item.credentialUrl && (
            <a
              href={item.credentialUrl}
              target="_blank"
              rel="nofollow noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              Ver certificado
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </BlurFade>
  );
}

export function EducationSection({ education }: EducationSectionProps) {
  if (education.length === 0) return null;

  return (
    <BlurFade direction="up" duration={0.5} inView className="space-y-8">
      {/* Section header */}
      <div className="space-y-1">
        <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">formação</p>
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Educação & Cursos</h2>
      </div>

      {/* Timeline */}
      <div>
        {education.map((item, i) => (
          <EducationCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </BlurFade>
  );
}
