'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { EducationForm } from '@/components/admin/EducationForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminEducationItem } from '@/hooks/admin/use-admin-education';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function EditEducationPage({ params }: Props) {
  const { slug } = use(params);
  const { data, isLoading, isError } = useAdminEducationItem(slug);
  const item = data;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild size="icon" variant="ghost" className="h-7 w-7 text-zinc-500">
          <Link href="/admin/education">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isLoading ? (
              <Skeleton className="h-6 w-48 bg-zinc-800 inline-block" />
            ) : (
              `Editar: ${item?.title ?? slug}`
            )}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Atualize a formação acadêmica</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {(['sk0', 'sk1', 'sk2', 'sk3', 'sk4'] as const).map((sk) => (
            <Skeleton key={sk} className="h-10 w-full bg-zinc-800 rounded-lg" />
          ))}
        </div>
      ) : isError || !item ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">Formação não encontrada</p>
          <Button asChild size="sm" variant="ghost" className="text-xs text-zinc-400">
            <Link href="/admin/education">Voltar</Link>
          </Button>
        </div>
      ) : (
        <EducationForm mode="edit" education={item} />
      )}
    </div>
  );
}
