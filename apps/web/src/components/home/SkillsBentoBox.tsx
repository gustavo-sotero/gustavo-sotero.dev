import type { Skill } from '@portfolio/shared/types/skills';
import { Star } from 'lucide-react';
import { TechIcon } from '@/components/shared/TechIcon';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
};

interface SkillsBentoBoxProps {
  skills: Skill[];
}

const EXPERTISE_LABELS: Record<Skill['expertiseLevel'], string> = {
  1: 'Base solida',
  2: 'Intermediario',
  3: 'Avancado',
};

function getExpertiseLabel(skill: Skill) {
  return `${skill.name}: ${skill.expertiseLevel} de 3 estrelas`;
}

function getCategorySummary(skills: Skill[]) {
  const highlightedCount = skills.filter((skill) => skill.isHighlighted).length;
  const technologyLabel = skills.length === 1 ? 'tecnologia' : 'tecnologias';
  const highlightLabel = highlightedCount === 1 ? 'destaque' : 'destaques';

  return highlightedCount > 0
    ? `${skills.length} ${technologyLabel} • ${highlightedCount} ${highlightLabel}`
    : `${skills.length} ${technologyLabel}`;
}

function SkillExpertise({ skill }: { skill: Skill }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={getExpertiseLabel(skill)}>
      {([1, 2, 3] as const).map((starNumber) => {
        const filled = starNumber <= skill.expertiseLevel;
        return (
          <Star
            key={`${skill.id}-star-${starNumber}`}
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              filled
                ? 'fill-emerald-400 text-emerald-400'
                : 'fill-zinc-800 text-zinc-600 stroke-zinc-600'
            )}
          />
        );
      })}
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border px-3.5 py-3 transition-all duration-200',
        skill.isHighlighted
          ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
          : 'border-zinc-800/80 bg-zinc-900/60',
        'cursor-default backdrop-blur-sm hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/80'
      )}
    >
      <span
        className={cn(
          'absolute inset-y-2 left-0 w-px rounded-full',
          skill.isHighlighted ? 'bg-emerald-500/70' : 'bg-zinc-800'
        )}
        aria-hidden="true"
      />

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
            skill.isHighlighted
              ? 'border-emerald-500/25 bg-emerald-500/10'
              : 'border-zinc-800 bg-zinc-950/70 group-hover:border-zinc-700'
          )}
        >
          <TechIcon
            iconKey={skill.iconKey}
            category={skill.category}
            name={skill.name}
            originalColor
            className="h-5 w-5"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-100">{skill.name}</span>
            {skill.isHighlighted && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                <span>Destaque</span>
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-500">
              {EXPERTISE_LABELS[skill.expertiseLevel]}
            </span>
            <SkillExpertise skill={skill} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkillsBentoBox({ skills }: SkillsBentoBoxProps) {
  if (skills.length === 0) return null;

  // Group all skills by category
  const grouped = skills.reduce(
    (acc, skill) => {
      const cat = skill.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  // Within each category, sort highlighted skills first (defense-in-depth)
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (b.isHighlighted ? 1 : 0) - (a.isHighlighted ? 1 : 0));
  }

  const categoryOrder = ['language', 'framework', 'db', 'tool', 'cloud', 'infra'];

  return (
    <BlurFade direction="up" duration={0.5} inView className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">stack</p>
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Stack & Skills</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Tecnologias que entram com mais frequencia no meu fluxo de produto, frontend e backend,
          com nivel de profundidade visivel em cada stack.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm md:p-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(63,63,70,0.28),transparent_32%)]"
          aria-hidden="true"
        />
        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2">
          {categoryOrder.map((category) => {
            const categorySkills = grouped[category];
            if (!categorySkills || categorySkills.length === 0) return null;

            return (
              <div
                key={category}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-500">
                      {CATEGORY_LABELS[category] ?? category}
                    </p>
                    <p className="text-sm text-zinc-400">{getCategorySummary(categorySkills)}</p>
                  </div>
                  <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    {String(categorySkills.length).padStart(2, '0')}
                  </span>
                </div>

                <div className="my-4 h-px bg-zinc-800/80" aria-hidden="true" />

                <div className="space-y-2">
                  {categorySkills.map((skill) => (
                    <SkillRow key={skill.id} skill={skill} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BlurFade>
  );
}
