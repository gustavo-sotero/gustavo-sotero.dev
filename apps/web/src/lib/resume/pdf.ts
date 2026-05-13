export const RESUME_PDF_PATH = '/curriculo.pdf';
export const RESUME_PDF_FILENAME = 'curriculo-gustavo-sotero.pdf';
export const RESUME_PDF_CACHE_CONTROL = 'public, no-cache, must-revalidate';
/** Bump when the PDF template/layout changes without altering the resume data payload itself. */
export const RESUME_PDF_TEMPLATE_VERSION = '2026-05-13.1';

export function formatResumeGeneratedAt(now: Date): string {
  return now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
