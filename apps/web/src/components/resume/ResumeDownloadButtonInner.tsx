'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import type { ResumeViewModel } from '@/lib/resume/mapper';
import { ResumePdfDocument } from './ResumePdfDocument';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumeDownloadButtonProps {
  resume: ResumeViewModel;
  /** Button variant: 'primary' renders a filled button; 'outline' renders a bordered one */
  variant?: 'primary' | 'outline';
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILENAME = 'curriculo-gustavo-sotero.pdf';

function baseClasses(variant: 'primary' | 'outline', extra = '') {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';
  const variantClass =
    variant === 'primary'
      ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
      : 'border border-zinc-700 text-zinc-300 bg-transparent hover:bg-zinc-800 hover:border-zinc-600 hover:text-zinc-100';
  return [base, variantClass, extra].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Component — direct use of @react-pdf/renderer (SSR-safe via ssr:false parent)
// ---------------------------------------------------------------------------

export function ResumeDownloadButtonInner({
  resume,
  variant = 'primary',
  className = '',
}: ResumeDownloadButtonProps) {
  return (
    <PDFDownloadLink
      document={<ResumePdfDocument resume={resume} />}
      fileName={FILENAME}
      className={baseClasses(variant, className)}
      aria-label="Baixar currículo em PDF"
    >
      {({ loading, error }) => {
        if (error) {
          return (
            <>
              <Download className="h-4 w-4" />
              Falha ao gerar PDF — tente novamente
            </>
          );
        }
        if (loading) {
          return (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando PDF...
            </>
          );
        }
        return (
          <>
            <Download className="h-4 w-4" />
            Baixar currículo em PDF
          </>
        );
      }}
    </PDFDownloadLink>
  );
}
