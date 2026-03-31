'use client';

// global-error renders outside the root layout, so it must supply its own
// html/body shell along with global styles and fonts. See:
// https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
import './globals.css';

import { useEffect } from 'react';
import { PublicSpecialPage } from '@/components/shared/PublicSpecialPage';
import { Button } from '@/components/ui/button';
import { jetbrainsMono, sora } from './fonts';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log for debugging; never surfaces error.message to the UI in production
    console.error('[boundary:global]', error);
  }, [error]);

  return (
    <html lang="pt-BR" className="dark">
      {/* metadata exports are unsupported in Client Components; use <title> */}
      <title>Erro crítico — Gustavo Sotero</title>
      <body
        className={`${sora.variable} ${jetbrainsMono.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}
      >
        <PublicSpecialPage
          code="500"
          kicker="500 Internal Error"
          title="Erro crítico"
          description="Ocorreu um erro inesperado. Tente novamente ou entre em contato se o problema persistir."
          tone="destructive"
          fullViewport
          action={
            <Button
              onClick={unstable_retry}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
            >
              Tentar novamente
            </Button>
          }
        />
      </body>
    </html>
  );
}
