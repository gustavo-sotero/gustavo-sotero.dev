import { Skeleton } from '@/components/ui/skeleton';

const CARD_SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;
const SKILL_SKELETON_KEYS = ['sk1', 'sk2', 'sk3', 'sk4', 'sk5', 'sk6', 'sk7', 'sk8'] as const;
const EXP_SKELETON_KEYS = ['e1', 'e2', 'e3'] as const;
const EDU_SKELETON_KEYS = ['d1', 'd2'] as const;

const CardSkeleton = () => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 h-[280px]">
    <Skeleton className="h-40 w-full rounded-lg" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-4/5" />
  </div>
);

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  const keys = CARD_SKELETON_KEYS.slice(0, count);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {keys.map((k) => (
        <CardSkeleton key={k} />
      ))}
    </div>
  );
}

export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function FeaturedProjectsSkeleton() {
  return (
    <div className="space-y-8">
      <SectionHeaderSkeleton />
      <CardGridSkeleton count={3} />
    </div>
  );
}

export function RecentPostsSkeleton() {
  return (
    <div className="space-y-8">
      <SectionHeaderSkeleton />
      <CardGridSkeleton count={3} />
    </div>
  );
}

export function SkillsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SKILL_SKELETON_KEYS.map((k) => (
          <Skeleton key={k} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ExperienceSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
      </div>
      <div className="space-y-4">
        {EXP_SKELETON_KEYS.map((k) => (
          <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EducationSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-4">
        {EDU_SKELETON_KEYS.map((k) => (
          <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
