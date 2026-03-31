'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { PublicSpecialPage } from '@/components/shared/PublicSpecialPage';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[boundary:public]', error);
  }, [error]);

  return (
    <PublicSpecialPage
      kicker="Unexpected Error"
      icon={<AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />}
      title="Algo deu errado"
      description="Ocorreu um erro inesperado. Tente novamente ou volte mais tarde."
      headingLevel={2}
      action={
        <Button
          onClick={unstable_retry}
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
        >
          Tentar novamente
        </Button>
      }
    />
  );
}
