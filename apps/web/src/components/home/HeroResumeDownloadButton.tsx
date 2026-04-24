'use client';

import { Download, Loader2 } from 'lucide-react';
import { ShimmerLink } from '@/components/ui/shimmer-button';
import { useResumePdfDownload } from '@/hooks/useResumePdfDownload';
import { RESUME_PDF_PATH } from '@/lib/resume/pdf';
import { cn } from '@/lib/utils';

export function HeroResumeDownloadButton() {
  const { isPreparing, handleClick } = useResumePdfDownload();

  return (
    <ShimmerLink
      href={RESUME_PDF_PATH}
      download
      onClick={handleClick}
      background="rgba(5, 150, 105, 1)"
      shimmerColor="#34d399"
      borderRadius="8px"
      className={cn(
        'text-sm font-semibold px-6 py-2.5 shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        isPreparing && 'cursor-wait opacity-90'
      )}
      aria-busy={isPreparing}
      aria-disabled={isPreparing}
      aria-label={isPreparing ? 'Gerando PDF do currículo' : 'Baixar currículo em PDF'}
    >
      {isPreparing ? (
        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4 shrink-0" />
      )}
      {isPreparing ? 'Gerando PDF...' : 'Baixar Currículo'}
    </ShimmerLink>
  );
}
