'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-sans text-zinc-100">Algo deu errado</h2>
        <p className="text-muted-foreground max-w-sm">
          Ocorreu um erro inesperado. Tente novamente ou volte mais tarde.
        </p>
      </div>
      <Button
        onClick={reset}
        variant="outline"
        className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
      >
        Tentar novamente
      </Button>
    </div>
  );
}
