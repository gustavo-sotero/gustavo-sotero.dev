import { Skeleton } from '@/components/ui/skeleton';

export function MetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
  accent,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 flex items-center gap-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent} shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-16 bg-zinc-800" />
        ) : (
          <p className="text-2xl font-bold text-zinc-100 tabular-nums">
            {value?.toLocaleString('pt-BR') ?? '—'}
          </p>
        )}
      </div>
    </div>
  );
}
