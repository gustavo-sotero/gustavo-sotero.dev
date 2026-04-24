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
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['sk-a', 'sk-b', 'sk-c', 'sk-d'] as const).map((k) => (
            <div
              key={k}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 md:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-7 w-10 rounded-full" />
              </div>
              <Skeleton className="my-4 h-px w-full" />
              <div className="space-y-2">
                {SKILL_SKELETON_KEYS.slice(0, 4).map((sk) => (
                  <Skeleton key={sk} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
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
