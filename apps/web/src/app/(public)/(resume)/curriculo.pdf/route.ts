import { renderToBuffer } from '@react-pdf/renderer';
import { unstable_rethrow } from 'next/navigation';
import { ResumePdfDocument } from '@/components/resume/ResumePdfDocument';
import { getResumeDataUncached } from '@/lib/data/public/resume';
import { buildResumeViewModel } from '@/lib/resume/mapper';
import {
  formatResumeGeneratedAt,
  RESUME_PDF_CACHE_CONTROL,
  RESUME_PDF_FILENAME,
} from '@/lib/resume/pdf';
import { createResumePdfEtag, requestMatchesEtag } from '@/lib/resume/pdf-version';
import { logServerError } from '@/lib/server-logger';

export async function GET(request: Request) {
  const now = new Date();
  const ifNoneMatch = request.headers.get('if-none-match');

  try {
    const resumeResult = await getResumeDataUncached();
    const resume = buildResumeViewModel({ ...resumeResult.data, now });
    const generatedAt = formatResumeGeneratedAt(now);
    const etag = createResumePdfEtag(resume, generatedAt);

    if (requestMatchesEtag(ifNoneMatch, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${RESUME_PDF_FILENAME}"`,
          'Cache-Control': RESUME_PDF_CACHE_CONTROL,
          ETag: etag,
        },
      });
    }

    const pdfBuffer = await renderToBuffer(
      ResumePdfDocument({
        resume,
        generatedAt,
      })
    );

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${RESUME_PDF_FILENAME}"`,
        'Cache-Control': RESUME_PDF_CACHE_CONTROL,
        ETag: etag,
      },
    });
  } catch (err) {
    unstable_rethrow(err);

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
