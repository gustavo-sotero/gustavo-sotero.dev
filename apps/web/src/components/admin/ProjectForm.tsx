'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateProjectInput,
  createProjectSchema,
  generateSlug,
  type Project,
  type Skill,
  type Tag,
} from '@portfolio/shared';
import type { z } from 'zod';

type ProjectFormValues = z.input<typeof createProjectSchema>;

function toProjectPayload(values: CreateProjectInput): CreateProjectInput {
  return {
    ...values,
    coverUrl: values.coverUrl || undefined,
    description: values.description || undefined,
    content: values.content || undefined,
    slug: values.slug || undefined,
    repositoryUrl: values.repositoryUrl || undefined,
    liveUrl: values.liveUrl || undefined,
    impactFacts: values.impactFacts ?? [],
  };
}

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useCreateProject, useUpdateProject } from '@/hooks/admin/use-admin-projects';
import { useAdminSkills } from '@/hooks/admin/use-admin-skills';
import { useAdminTags } from '@/hooks/admin/use-admin-tags';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';
import { CreateSkillDialogForm } from './CreateSkillDialogForm';
import { CreateTagDialogForm } from './CreateTagDialogForm';
import { ImpactFactsEditor } from './ImpactFactsEditor';
import { MarkdownEditor } from './MarkdownEditor';
import { TagCheckboxGroup } from './TagCheckboxGroup';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  project?: Project;
}

export function ProjectForm({ mode, project }: ProjectFormProps) {
  const router = useRouter();
  const { data: allTags = [], isLoading: tagsLoading } = useAdminTags();
  const { data: allSkills = [], isLoading: skillsLoading } = useAdminSkills();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject(project?.id ?? 0, project?.slug);
  const [autoSlug, setAutoSlug] = useState(mode === 'create');
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const [createSkillOpen, setCreateSkillOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues, unknown, CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: project?.title ?? '',
      slug: project?.slug ?? '',
      description: project?.description ?? '',
      content: project?.content ?? '',
      coverUrl: project?.coverUrl ?? '',
      status: (project?.status === 'published' ? 'published' : 'draft') as 'draft' | 'published',
      repositoryUrl: project?.repositoryUrl ?? '',
      liveUrl: project?.liveUrl ?? '',
      featured: project?.featured ?? false,
      order: project?.order ?? 0,
      impactFacts: project?.impactFacts ?? [],
      tagIds: project?.tags?.map((t) => t.id) ?? [],
      skillIds: project?.skills?.map((s) => s.id) ?? [],
    },
  });

  const titleField = register('title');

  function syncAutoSlug(nextTitle: string) {
    if (!autoSlug) return;
    setValue('slug', generateSlug(nextTitle), { shouldValidate: false });
  }

  function toggleAutoSlug() {
    setAutoSlug((current) => {
      const next = !current;
      if (next) {
        syncAutoSlug(getValues('title') ?? '');
      }
      return next;
    });
  }

  function handleTagCreated(tag: Tag) {
    const current = getValues('tagIds') ?? [];
    if (!current.includes(tag.id)) {
      setValue('tagIds', [...current, tag.id]);
    }
    setCreateTagOpen(false);
  }

  function handleSkillCreated(skill: Skill) {
    const current = getValues('skillIds') ?? [];
    if (!current.includes(skill.id)) {
      setValue('skillIds', [...current, skill.id]);
    }
  }

  async function onSubmit(values: CreateProjectInput) {
    const payload = toProjectPayload(values);

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
        router.push('/admin/projects');
      } else if (project) {
        await updateMutation.mutateAsync(payload);
        router.push('/admin/projects');
      }
    } catch {
      // Mutation errors are displayed via toast (in mutation hook).
      // This catch prevents unhandled promise rejection if the hook re-throws.
      return;
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-zinc-300 text-sm">
          Título <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          {...titleField}
          onChange={(e) => {
            titleField.onChange(e);
            syncAutoSlug(e.target.value);
          }}
          placeholder="Título do projeto"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
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
          placeholder="meu-projeto"
          readOnly={autoSlug}
          className={cn(
            'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm',
            'focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60',
            autoSlug && 'text-zinc-500 cursor-default'
          )}
        />
        {errors.slug && <p className="text-xs text-red-400">{errors.slug.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-zinc-300 text-sm">
          Descrição
          <span className="text-zinc-600 text-xs ml-2">(resumo curto)</span>
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Breve descrição do projeto..."
          rows={2}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none overflow-y-auto field-sizing-fixed focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-sm">Conteúdo</Label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <MarkdownEditor value={field.value ?? ''} onChange={field.onChange} minHeight={300} />
          )}
        />
      </div>

      {/* Cover media — unified upload + preview field */}
      <Controller
        name="coverUrl"
        control={control}
        render={({ field }) => (
          <CoverMediaField
            label="Capa"
            value={field.value ?? ''}
            onChange={(url) =>
              setValue('coverUrl', url, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            error={errors.coverUrl?.message}
          />
        )}
      />

      {/* Repository + Live URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="repositoryUrl" className="text-zinc-300 text-sm">
            Repositório
          </Label>
          <Input
            id="repositoryUrl"
            {...register('repositoryUrl')}
            placeholder="https://github.com/..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="liveUrl" className="text-zinc-300 text-sm">
            URL ao vivo
          </Label>
          <Input
            id="liveUrl"
            {...register('liveUrl')}
            placeholder="https://..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Status + Featured + Order */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-2">
          <Label className="text-zinc-300 text-sm">Status</Label>
          <Select
            defaultValue={project?.status ?? 'draft'}
            onValueChange={(v) => setValue('status', v as 'draft' | 'published')}
          >
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem
                value="draft"
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Rascunho
              </SelectItem>
              <SelectItem
                value="published"
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                Publicado
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-300 text-sm">Ordem</Label>
          <Input
            type="number"
            {...register('order', { valueAsNumber: true })}
            className="w-20 bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40"
            min={0}
          />
        </div>

        <div className="flex items-center gap-3 pb-0.5">
          <Controller
            name="featured"
            control={control}
            render={({ field }) => (
              <Switch
                id="featured"
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
                className="data-[state=checked]:bg-emerald-500"
              />
            )}
          />
          <Label htmlFor="featured" className="text-zinc-300 text-sm cursor-pointer">
            Projeto em destaque
          </Label>
        </div>
      </div>

      {/* Impact Facts */}
      <Controller
        name="impactFacts"
        control={control}
        render={({ field }) => (
          <ImpactFactsEditor
            value={field.value ?? []}
            onChange={field.onChange}
            error={errors.impactFacts?.message}
          />
        )}
      />

      {/* Tags */}
      {!tagsLoading && (
        <Controller
          name="tagIds"
          control={control}
          render={({ field }) => (
            <TagCheckboxGroup
              label="Tags"
              tags={allTags}
              selectedIds={field.value ?? []}
              onToggle={(tagId) => {
                const current = field.value ?? [];
                const exists = current.includes(tagId);
                field.onChange(exists ? current.filter((id) => id !== tagId) : [...current, tagId]);
              }}
              onCreateTag={() => setCreateTagOpen(true)}
            />
          )}
        />
      )}

      {/* Skills */}
      {!skillsLoading && allSkills.length > 0 && (
        <Controller
          name="skillIds"
          control={control}
          render={({ field }) => (
            <TagCheckboxGroup
              label="Skills"
              tags={allSkills}
              selectedIds={field.value ?? []}
              onToggle={(skillId) => {
                const current = field.value ?? [];
                const exists = current.includes(skillId);
                field.onChange(
                  exists ? current.filter((id) => id !== skillId) : [...current, skillId]
                );
              }}
              onCreateTag={() => setCreateSkillOpen(true)}
              createLabel="Criar skill"
            />
          )}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
        >
          {isPending ? 'Salvando...' : mode === 'create' ? 'Criar projeto' : 'Salvar alterações'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/projects')}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Cancelar
        </Button>
      </div>

      {/* Inline tag creation — opens without leaving the page */}
      <CreateTagDialogForm
        open={createTagOpen}
        onClose={() => setCreateTagOpen(false)}
        onTagCreated={handleTagCreated}
      />
      {/* Inline skill creation — opens without leaving the page */}
      <CreateSkillDialogForm
        open={createSkillOpen}
        onClose={() => setCreateSkillOpen(false)}
        onSkillCreated={handleSkillCreated}
      />
    </form>
  );
}
