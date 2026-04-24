'use client';

import { Download, Loader2 } from 'lucide-react';
import { useResumePdfDownload } from '@/hooks/useResumePdfDownload';
import { RESUME_PDF_PATH } from '@/lib/resume/pdf';
import { cn } from '@/lib/utils';

export interface ResumeDownloadButtonProps {
  variant?: 'primary' | 'outline';
  className?: string;
}

function baseClasses(variant: 'primary' | 'outline', extra = '') {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';
  const variantClass =
    variant === 'primary'
      ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
      : 'border border-zinc-700 text-zinc-300 bg-transparent hover:bg-zinc-800 hover:border-zinc-600 hover:text-zinc-100';
  return [base, variantClass, extra].filter(Boolean).join(' ');
}

export function ResumeDownloadButton({
  variant = 'primary',
  className = '',
}: ResumeDownloadButtonProps) {
  const { isPreparing, handleClick } = useResumePdfDownload();

  return (
    <a
      href={RESUME_PDF_PATH}
      download
      onClick={handleClick}
      className={cn(baseClasses(variant, className), isPreparing && 'cursor-wait opacity-90')}
      aria-busy={isPreparing}
      aria-disabled={isPreparing}
      aria-label={isPreparing ? 'Gerando PDF do currículo' : 'Baixar currículo em PDF'}
    >
      {isPreparing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isPreparing ? 'Gerando PDF...' : 'Baixar currículo em PDF'}
    </a>
  );
}
