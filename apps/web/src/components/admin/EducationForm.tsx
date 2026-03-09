'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Education } from '@portfolio/shared';
import {
  createEducationSchema,
  type UpdateEducationInput,
  updateEducationSchema,
} from '@portfolio/shared';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { generateSlug, useCreateEducation, useUpdateEducation } from '@/hooks/use-admin-queries';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';

interface EducationFormProps {
  mode: 'create' | 'edit';
  education?: Education;
}

export function EducationForm({ mode, education }: EducationFormProps) {
  const router = useRouter();
  const createMutation = useCreateEducation();
  const updateMutation = useUpdateEducation(education?.id ?? 0);
  const [autoSlug, setAutoSlug] = useState(mode === 'create');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEducationInput>({
    resolver: zodResolver(
      mode === 'create' ? createEducationSchema : updateEducationSchema
    ) as Resolver<UpdateEducationInput>,
    defaultValues: {
      title: education?.title ?? '',
      institution: education?.institution ?? '',
      slug: education?.slug ?? '',
      description: education?.description ?? '',
      location: education?.location ?? '',
      educationType: education?.educationType ?? '',
      startDate: education?.startDate ?? '',
      endDate: education?.endDate ?? '',
      isCurrent: education?.isCurrent ?? false,
      workloadHours: education?.workloadHours ?? undefined,
      credentialId: education?.credentialId ?? '',
      credentialUrl: education?.credentialUrl ?? '',
      order: education?.order ?? 0,
      status: (education?.status === 'published' ? 'published' : 'draft') as 'draft' | 'published',
      logoUrl: education?.logoUrl ?? '',
    },
  });

  const title = watch('title');
  const isCurrent = watch('isCurrent');

  useEffect(() => {
    if (autoSlug && title) {
      const institution = watch('institution') ?? '';
      setValue('slug', generateSlug(`${title}-${institution}`), { shouldValidate: false });
    }
  }, [title, autoSlug, setValue, watch]);

  async function onSubmit(data: UpdateEducationInput) {
    const payload = {
      ...data,
      location: data.location || undefined,
      educationType: data.educationType || undefined,
      description: data.description || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      credentialId: data.credentialId || undefined,
      credentialUrl: data.credentialUrl || undefined,
      logoUrl: data.logoUrl || undefined,
      slug: data.slug || undefined,
    };

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload as never);
        router.push('/admin/education');
      } else if (education) {
        await updateMutation.mutateAsync(payload);
        router.push('/admin/education');
      }
    } catch {
      return;
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-zinc-300 text-sm">
          Título / Curso <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="Ciência da Computação"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.title && <p className="text-xs text-red-400">{String(errors.title.message)}</p>}
      </div>

      {/* Institution */}
      <div className="space-y-2">
        <Label htmlFor="institution" className="text-zinc-300 text-sm">
          Instituição <span className="text-red-400">*</span>
        </Label>
        <Input
          id="institution"
          {...register('institution')}
          placeholder="Universidade XYZ"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.institution && (
          <p className="text-xs text-red-400">{String(errors.institution.message)}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="slug" className="text-zinc-300 text-sm">
            Slug
          </Label>
          {mode === 'create' && (
            <button
              type="button"
              onClick={() => setAutoSlug((v) => !v)}
              className={cn(
                'text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-colors',
                autoSlug
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Sparkles size={10} />
              {autoSlug ? 'Auto-gerado' : 'Gerar auto'}
            </button>
          )}
        </div>
        <Input
          id="slug"
          {...register('slug')}
          placeholder="ciencia-computacao-xyz"
          readOnly={autoSlug}
          className={cn(
            'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm',
            'focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60',
            autoSlug && 'text-zinc-500 cursor-default'
          )}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-zinc-300 text-sm">
          Descrição
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descreva o curso ou formação..."
          rows={3}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
      </div>

      {/* Location + Education Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location" className="text-zinc-300 text-sm">
            Localização
          </Label>
          <Input
            id="location"
            {...register('location')}
            placeholder="São Paulo, SP"
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="educationType" className="text-zinc-300 text-sm">
            Tipo
          </Label>
          <Input
            id="educationType"
            {...register('educationType')}
            placeholder="Graduação, Pós, Bootcamp..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-zinc-300 text-sm">
            Data de início
          </Label>
          <Input
            id="startDate"
            type="date"
            {...register('startDate', { setValueAs: (v) => v || undefined })}
            className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
          {errors.startDate && (
            <p className="text-xs text-red-400">{String(errors.startDate.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-zinc-300 text-sm">
            Data de conclusão
          </Label>
          <Input
            id="endDate"
            type="date"
            {...register('endDate', { setValueAs: (v) => v || undefined })}
            disabled={isCurrent}
            className={cn(
              'bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60',
              isCurrent && 'opacity-40 cursor-not-allowed'
            )}
          />
          {errors.endDate && (
            <p className="text-xs text-red-400">{String(errors.endDate.message)}</p>
          )}
        </div>
      </div>

      {/* isCurrent + Workload + Order + Status */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex items-center gap-3">
          <Switch
            id="isCurrent"
            checked={isCurrent ?? false}
            onCheckedChange={(v) => setValue('isCurrent', v)}
            className="data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="isCurrent" className="text-zinc-300 text-sm cursor-pointer">
            Em andamento
          </Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workloadHours" className="text-zinc-300 text-sm">
            Carga horária (h)
          </Label>
          <Input
            id="workloadHours"
            type="number"
            {...register('workloadHours', {
              setValueAs: (v) => (v === '' || v == null ? undefined : parseInt(String(v), 10)),
            })}
            placeholder="360"
            className="w-24 bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40"
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-300 text-sm">Ordem</Label>
          <Input
            type="number"
            {...register('order', {
              setValueAs: (v) => (v === '' || v == null ? 0 : parseInt(String(v), 10)),
            })}
            className="w-20 bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40"
            min={0}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-300 text-sm">Status</Label>
          <Select
            defaultValue={education?.status ?? 'draft'}
            onValueChange={(v) => setValue('status', v as 'draft' | 'published')}
          >
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="draft" className="text-zinc-300 focus:bg-zinc-800">
                Rascunho
              </SelectItem>
              <SelectItem value="published" className="text-zinc-300 focus:bg-zinc-800">
                Publicado
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Credential */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="credentialId" className="text-zinc-300 text-sm">
            ID da credencial
          </Label>
          <Input
            id="credentialId"
            {...register('credentialId')}
            placeholder="ABC-123"
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credentialUrl" className="text-zinc-300 text-sm">
            URL da credencial
          </Label>
          <Input
            id="credentialUrl"
            {...register('credentialUrl')}
            placeholder="https://..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Logo media — unified upload + preview field */}
      <CoverMediaField
        label="Logo da instituição"
        value={watch('logoUrl') ?? ''}
        onChange={(url) =>
          setValue('logoUrl', url, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          })
        }
        error={errors.logoUrl?.message}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
        >
          {isPending ? 'Salvando...' : mode === 'create' ? 'Criar formação' : 'Salvar alterações'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/education')}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
