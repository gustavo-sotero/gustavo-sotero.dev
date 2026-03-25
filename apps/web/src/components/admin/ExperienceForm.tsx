'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Experience, Tag } from '@portfolio/shared';
import { type CreateExperienceInput, createExperienceSchema } from '@portfolio/shared';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  generateSlug,
  useAdminTags,
  useCreateExperience,
  useUpdateExperience,
} from '@/hooks/use-admin-queries';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';
import { CreateTagDialogForm } from './CreateTagDialogForm';
import { TagCheckboxGroup } from './TagCheckboxGroup';

interface ExperienceFormProps {
  mode: 'create' | 'edit';
  experience?: Experience;
}

type ExperienceFormValues = z.input<typeof createExperienceSchema>;

function toExperiencePayload(values: ExperienceFormValues): CreateExperienceInput {
  return {
    ...values,
    isCurrent: values.isCurrent ?? false,
    order: values.order ?? 0,
    status: values.status ?? 'draft',
    location: values.location || undefined,
    employmentType: values.employmentType || undefined,
    endDate: values.endDate || undefined,
    logoUrl: values.logoUrl || undefined,
    credentialUrl: values.credentialUrl || undefined,
    slug: values.slug || undefined,
  };
}

export function ExperienceForm({ mode, experience }: ExperienceFormProps) {
  const router = useRouter();
  const createMutation = useCreateExperience();
  const updateMutation = useUpdateExperience(experience?.id ?? 0);
  const [autoSlug, setAutoSlug] = useState(mode === 'create');
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const { data: allTags = [], isLoading: tagsLoading } = useAdminTags();

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceFormValues>({
    resolver: zodResolver(createExperienceSchema),
    defaultValues: {
      role: experience?.role ?? '',
      company: experience?.company ?? '',
      slug: experience?.slug ?? '',
      description: experience?.description ?? '',
      location: experience?.location ?? '',
      employmentType: experience?.employmentType ?? '',
      startDate: experience?.startDate ?? '',
      endDate: experience?.endDate ?? '',
      isCurrent: experience?.isCurrent ?? false,
      order: experience?.order ?? 0,
      status: (experience?.status === 'published' ? 'published' : 'draft') as 'draft' | 'published',
      logoUrl: experience?.logoUrl ?? '',
      credentialUrl: experience?.credentialUrl ?? '',
      tagIds: experience?.tags?.map((t) => t.id) ?? [],
    },
  });

  const roleField = register('role');
  const companyField = register('company');

  function buildExperienceSlug(nextRole: string, nextCompany: string) {
    const slugSource = [nextRole, nextCompany]
      .map((value) => value.trim())
      .filter(Boolean)
      .join('-');
    return slugSource ? generateSlug(slugSource) : '';
  }

  function syncAutoSlug(nextRole: string, nextCompany: string) {
    if (!autoSlug) {
      return;
    }

    setValue('slug', buildExperienceSlug(nextRole, nextCompany), { shouldValidate: false });
  }

  function toggleAutoSlug() {
    setAutoSlug((current) => {
      const next = !current;

      if (next) {
        syncAutoSlug(getValues('role') ?? '', getValues('company') ?? '');
      }

      return next;
    });
  }

  const isCurrent = watch('isCurrent');
  const selectedTagIds = watch('tagIds') ?? [];

  function toggleTag(tagId: number) {
    const current = selectedTagIds ?? [];
    const exists = current.includes(tagId);
    setValue('tagIds', exists ? current.filter((id) => id !== tagId) : [...current, tagId]);
  }

  function handleTagCreated(tag: Tag) {
    const current = selectedTagIds ?? [];
    if (!current.includes(tag.id)) {
      setValue('tagIds', [...current, tag.id]);
    }
    setCreateTagOpen(false);
  }

  async function onSubmit(values: ExperienceFormValues) {
    const payload = toExperiencePayload(values);

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
        router.push('/admin/experience');
      } else if (experience) {
        await updateMutation.mutateAsync(payload);
        router.push('/admin/experience');
      }
    } catch {
      return;
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Role */}
      <div className="space-y-2">
        <Label htmlFor="role" className="text-zinc-300 text-sm">
          Cargo <span className="text-red-400">*</span>
        </Label>
        <Input
          id="role"
          {...roleField}
          onChange={(event) => {
            roleField.onChange(event);
            syncAutoSlug(event.target.value, getValues('company') ?? '');
          }}
          placeholder="Software Engineer"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.role && <p className="text-xs text-red-400">{String(errors.role.message)}</p>}
      </div>

      {/* Company */}
      <div className="space-y-2">
        <Label htmlFor="company" className="text-zinc-300 text-sm">
          Empresa <span className="text-red-400">*</span>
        </Label>
        <Input
          id="company"
          {...companyField}
          onChange={(event) => {
            companyField.onChange(event);
            syncAutoSlug(getValues('role') ?? '', event.target.value);
          }}
          placeholder="Empresa Ltda"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.company && <p className="text-xs text-red-400">{String(errors.company.message)}</p>}
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
              onClick={toggleAutoSlug}
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
          placeholder="software-engineer-empresa"
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
          Descrição <span className="text-red-400">*</span>
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descreva suas responsabilidades..."
          rows={4}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.description && (
          <p className="text-xs text-red-400">{String(errors.description.message)}</p>
        )}
      </div>

      {/* Location + Employment Type */}
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
          <Label htmlFor="employmentType" className="text-zinc-300 text-sm">
            Tipo de contrato
          </Label>
          <Input
            id="employmentType"
            {...register('employmentType')}
            placeholder="CLT, PJ, Freelance..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-zinc-300 text-sm">
            Data de início <span className="text-red-400">*</span>
          </Label>
          <Input
            id="startDate"
            type="date"
            {...register('startDate')}
            className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
          {errors.startDate && (
            <p className="text-xs text-red-400">{String(errors.startDate.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-zinc-300 text-sm">
            Data de fim
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

      {/* isCurrent + Order + Status */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex items-center gap-3">
          <Switch
            id="isCurrent"
            checked={isCurrent ?? false}
            onCheckedChange={(v) => setValue('isCurrent', v)}
            className="data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="isCurrent" className="text-zinc-300 text-sm cursor-pointer">
            Emprego atual
          </Label>
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
            defaultValue={experience?.status ?? 'draft'}
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

      {/* Logo media — unified upload + preview field */}
      <CoverMediaField
        label="Logo da empresa"
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

      {/* Credential URL */}
      <div className="space-y-2">
        <Label htmlFor="credentialUrl" className="text-zinc-300 text-sm">
          URL de credencial
        </Label>
        <Input
          id="credentialUrl"
          {...register('credentialUrl')}
          placeholder="https://linkedin.com/..."
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
      </div>

      {/* Tags */}
      {!tagsLoading && allTags.length > 0 && (
        <TagCheckboxGroup
          label="Tecnologias"
          tags={allTags}
          selectedIds={selectedTagIds}
          onToggle={toggleTag}
          onCreateTag={() => setCreateTagOpen(true)}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
        >
          {isPending
            ? 'Salvando...'
            : mode === 'create'
              ? 'Criar experiência'
              : 'Salvar alterações'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/experience')}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Cancelar
        </Button>
      </div>

      <CreateTagDialogForm
        open={createTagOpen}
        onClose={() => setCreateTagOpen(false)}
        onTagCreated={handleTagCreated}
      />
    </form>
  );
}
