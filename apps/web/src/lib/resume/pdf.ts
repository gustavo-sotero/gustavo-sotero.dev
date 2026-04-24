export const RESUME_PDF_PATH = '/curriculo.pdf';
export const RESUME_PDF_FILENAME = 'curriculo-gustavo-sotero.pdf';

export function formatResumeGeneratedAt(now: Date): string {
  return now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
