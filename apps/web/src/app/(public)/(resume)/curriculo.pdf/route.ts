import { renderToBuffer } from '@react-pdf/renderer';
import { ResumePdfDocument } from '@/components/resume/ResumePdfDocument';
import { getResumeData } from '@/lib/data/public/resume';
import { buildResumeViewModel } from '@/lib/resume/mapper';
import { formatResumeGeneratedAt, RESUME_PDF_FILENAME } from '@/lib/resume/pdf';
import { logServerError } from '@/lib/server-logger';

export async function GET() {
  const now = new Date();

  try {
    const resumeResult = await getResumeData();
    const resume = buildResumeViewModel({ ...resumeResult.data, now });
    const pdfBuffer = await renderToBuffer(
      ResumePdfDocument({
        resume,
        generatedAt: formatResumeGeneratedAt(now),
      })
    );

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${RESUME_PDF_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logServerError('/curriculo.pdf', 'Failed to generate resume PDF', {
      error: err instanceof Error ? err.message : String(err),
    });

    return new Response('Nao foi possivel gerar o PDF do curriculo.', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
