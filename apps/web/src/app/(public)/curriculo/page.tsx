import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ResumeDownloadButton } from '@/components/resume/ResumeDownloadButton';
import { ResumePage } from '@/components/resume/ResumePage';
import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { SITE_BRAND_NAME, SITE_METADATA } from '@/lib/constants';
import { getResumeData } from '@/lib/data/public/resume';
import { buildResumeViewModel } from '@/lib/resume/mapper';
import CurriculoLoading from './loading';

export const metadata: Metadata = {
  title: `Currículo — ${SITE_BRAND_NAME}`,
  description: `Currículo profissional de ${SITE_BRAND_NAME} — ${DEVELOPER_PUBLIC_PROFILE.role}. ${DEVELOPER_PUBLIC_PROFILE.objective}`,
  openGraph: {
    title: `Currículo — ${SITE_BRAND_NAME}`,
    description: `Currículo profissional de ${SITE_BRAND_NAME} — ${DEVELOPER_PUBLIC_PROFILE.role}.`,
  },
  alternates: {
    canonical: `${SITE_METADATA.url}/curriculo`,
  },
};

export async function CurriculoContent() {
  await connection();
  const [resumeResult, now] = await Promise.all([getResumeData(), Promise.resolve(new Date())]);
  const resume = buildResumeViewModel({ ...resumeResult.data, now });
  const isDegraded = resumeResult.state === 'degraded';

  return (
    <div className="container mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Page header with download CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-12">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <FileText className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">
              currículo
            </p>
          </div>
          <p className="text-zinc-500 text-sm">
            Última atualização via painel admin — sempre em sincronia com o portfólio.
          </p>
        </div>
        <ResumeDownloadButton resume={resume} variant="primary" />
      </div>

      {isDegraded ? <SectionUnavailable /> : null}

      {/* Web view of the resume */}
      <ResumePage resume={resume} />

      {/* Bottom download CTA */}
      <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-center">
        <ResumeDownloadButton resume={resume} variant="outline" />
      </div>
    </div>
  );
}

export default function CurriculoPage() {
  return (
    <Suspense fallback={<CurriculoLoading />}>
      <CurriculoContent />
    </Suspense>
  );
}
