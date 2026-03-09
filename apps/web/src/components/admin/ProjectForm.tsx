'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Project, Tag } from '@portfolio/shared';
import { type CreateProjectInput, createProjectSchema } from '@portfolio/shared';
import { Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import {
  generateSlug,
  useAdminTags,
  useCreateProject,
  useUpdateProject,
} from '@/hooks/use-admin-queries';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';
import { CreateTagDialogForm } from './CreateTagDialogForm';
import { MarkdownEditor } from './MarkdownEditor';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  project?: Project;
}

export function ProjectForm({ mode, project }: ProjectFormProps) {
  const router = useRouter();
  const { data: allTags = [], isLoading: tagsLoading } = useAdminTags();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject(project?.id ?? 0, project?.slug);
  const [autoSlug, setAutoSlug] = useState(mode === 'create');
  const [createTagOpen, setCreateTagOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema) as Resolver<CreateProjectInput>,
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
      tagIds: project?.tags?.map((t) => t.id) ?? [],
    },
  });

  const title = watch('title');
  const content = watch('content') ?? '';
  const selectedTagIds = watch('tagIds') ?? [];
  const featured = watch('featured');

  useEffect(() => {
    if (autoSlug) {
      setValue('slug', generateSlug(title), { shouldValidate: false });
    }
  }, [title, autoSlug, setValue]);

  function toggleTag(tag: Tag) {
    const current = selectedTagIds ?? [];
    const exists = current.includes(tag.id);
    setValue('tagIds', exists ? current.filter((id) => id !== tag.id) : [...current, tag.id]);
  }

  function handleTagCreated(tag: Tag) {
    const current = selectedTagIds ?? [];
    if (!current.includes(tag.id)) {
      setValue('tagIds', [...current, tag.id]);
    }
    setCreateTagOpen(false);
  }

  async function onSubmit(data: CreateProjectInput) {
    const payload = {
      ...data,
      coverUrl: data.coverUrl || undefined,
      description: data.description || undefined,
      content: data.content || undefined,
      slug: data.slug || undefined,
      repositoryUrl: data.repositoryUrl || undefined,
      liveUrl: data.liveUrl || undefined,
    };

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
        router.push('/admin/projects');
      } else if (project) {
        await updateMutation.mutateAsync(payload);
        router.push('/admin/projects');
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
          Título <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          {...register('title')}
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
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-sm">Conteúdo</Label>
        <MarkdownEditor value={content} onChange={(v) => setValue('content', v)} minHeight={300} />
      </div>

      {/* Cover media — unified upload + preview field */}
      <CoverMediaField
        label="Capa"
        value={watch('coverUrl') ?? ''}
        onChange={(url) =>
          setValue('coverUrl', url, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          })
        }
        error={errors.coverUrl?.message}
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
          <Switch
            id="featured"
            checked={featured ?? false}
            onCheckedChange={(v) => setValue('featured', v)}
            className="data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="featured" className="text-zinc-300 text-sm cursor-pointer">
            Projeto em destaque
          </Label>
        </div>
      </div>

      {/* Tags */}
      {!tagsLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300 text-sm">Tags</Label>
            <button
              type="button"
              onClick={() => setCreateTagOpen(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Criar tag
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const selected = (selectedTagIds ?? []).includes(tag.id);
              return (
                <Badge
                  key={tag.id}
                  onClick={() => toggleTag(tag)}
                  variant={selected ? 'default' : 'secondary'}
                  className={cn(
                    'cursor-pointer transition-colors text-xs px-2.5',
                    selected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                  )}
                >
                  {tag.name}
                </Badge>
              );
            })}
          </div>
        </div>
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
    </form>
  );
}
