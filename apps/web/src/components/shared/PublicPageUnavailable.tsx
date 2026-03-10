import { WifiOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PublicPageUnavailableProps {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export function PublicPageUnavailable({
  title,
  description,
  backHref,
  backLabel,
}: PublicPageUnavailableProps) {
  return (
    <div className="container mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-16">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
            serviço indisponível
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
          <p className="max-w-xl text-sm text-zinc-400">{description}</p>
        </div>
        <Button asChild className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
