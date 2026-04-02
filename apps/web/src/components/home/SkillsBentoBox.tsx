import type { Tag } from '@portfolio/shared';
import { Star } from 'lucide-react';
import { TechIcon } from '@/components/shared/TechIcon';
import { BentoGrid } from '@/components/ui/bento-grid';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
  other: 'Outro',
};

interface SkillsBentoBoxProps {
  tags: Tag[];
}

function SkillCard({ tag, index }: { tag: Tag; index: number }) {
  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl overflow-hidden',
        'glass-card transition-all duration-200 cursor-default',
        'hover:bg-emerald-500/5 hover:border-emerald-500/30',
        'animate-skill-card'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Featured badge — shown only on highlighted tags */}
      {tag.isHighlighted && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm">
          <Star className="h-2 w-2 fill-current" />
          <span>Destaque</span>
        </div>
      )}

      <div className="transition-transform duration-200 group-hover:scale-110">
        <TechIcon
          iconKey={tag.iconKey}
          category={tag.category}
          name={tag.name}
          originalColor
          className="h-6 w-6"
        />
      </div>
      <div className="text-center">
        <p
          className={cn(
            'font-medium leading-tight group-hover:text-zinc-100',
            'text-xs text-zinc-200'
          )}
        >
          {tag.name}
        </p>
        <p className="text-[10px] text-zinc-400 mt-0.5">
          {CATEGORY_LABELS[tag.category ?? 'other']}
        </p>
      </div>
    </div>
  );
}

export function SkillsBentoBox({ tags }: SkillsBentoBoxProps) {
  if (tags.length === 0) return null;

  // Group all tags by category (highlighted ones stay in their category)
  const grouped = tags.reduce(
    (acc, tag) => {
      const cat = tag.category ?? 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  // Within each category, sort highlighted tags first
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (b.isHighlighted ? 1 : 0) - (a.isHighlighted ? 1 : 0));
  }

  const categoryOrder = ['language', 'framework', 'db', 'tool', 'cloud', 'infra', 'other'];

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div className="space-y-1">
        <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">stack</p>
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Stack & Skills</h2>
      </div>

      {/* Skills grouped by category */}
      <div className="space-y-6">
        {categoryOrder.map((category) => {
          const catTags = grouped[category];
          if (!catTags || catTags.length === 0) return null;

          return (
            <div key={category}>
              {/* Category label */}
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </p>

              <BentoGrid className="grid-cols-2 md:grid-cols-4 auto-rows-auto gap-3">
                {catTags.map((tag, i) => (
                  <SkillCard key={tag.id} tag={tag} index={i} />
                ))}
              </BentoGrid>
            </div>
          );
        })}
      </div>
    </div>
  );
}
