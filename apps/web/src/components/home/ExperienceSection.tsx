'use client';

import type { Experience } from '@portfolio/shared';
import { Briefcase, Building2, CalendarRange, ChevronDown, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';

interface ExperienceSectionProps {
  experience: Experience[];
}

function formatPeriod(startDate: string, endDate: string | null, isCurrent: boolean): string {
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

  const start = fmt(startDate);
  if (isCurrent) return `${start} — presente`;
  if (endDate) return `${start} — ${fmt(endDate)}`;
  return start;
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // Only measure when the clamp is active to avoid false negatives when expanded
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, [expanded]);

  return (
    <div>
      <p
        ref={ref}
        className={`text-sm text-zinc-400 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
      >
        {text}
      </p>
      {isClamped && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1.5 flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
        >
          {expanded ? 'ver menos' : 'ver mais'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}

function ExperienceCard({ item, index }: { item: Experience; index: number }) {
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
          <Briefcase className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors duration-200" />
        </div>
        {/* vertical line except for last item */}
        <div className="mt-2 w-px flex-1 bg-zinc-800/70" />
      </div>

      {/* Content */}
      <div className="pb-10 min-w-0 flex-1">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm transition-colors duration-200 group-hover:border-zinc-700">
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-100 text-base leading-snug">{item.role}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-zinc-400">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>{item.company}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              {item.isCurrent && (
                <Badge
                  variant="outline"
                  className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-xs"
                >
                  atual
                </Badge>
              )}
              {item.employmentType && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
                  {item.employmentType}
                </Badge>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 mb-3">
            <span className="flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />
              {formatPeriod(item.startDate, item.endDate ?? null, item.isCurrent)}
            </span>
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.location}
              </span>
            )}
          </div>

          {/* Description */}
          <ExpandableDescription text={item.description} />

          {/* Impact Facts */}
          {item.impactFacts && item.impactFacts.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {item.impactFacts.map((fact) => (
                <li
                  key={fact}
                  className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed"
                >
                  <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>
                  {fact}
                </li>
              ))}
            </ul>
          )}

          {/* Skills */}
          {item.skills && item.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.skills.map((skill) => (
                <Badge
                  key={skill.id}
                  variant="outline"
                  className="text-zinc-500 border-zinc-700/60 bg-zinc-800/40 text-xs px-2 py-0.5"
                >
                  {skill.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </BlurFade>
  );
}

export function ExperienceSection({ experience }: ExperienceSectionProps) {
  if (experience.length === 0) return null;

  return (
    <BlurFade direction="up" duration={0.5} inView className="space-y-8">
      {/* Section header */}
      <div className="space-y-1">
        <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">carreira</p>
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Experiência Profissional</h2>
      </div>

      {/* Timeline */}
      <div>
        {experience.map((item, i) => (
          <ExperienceCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </BlurFade>
  );
}
