'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Post, Tag } from '@portfolio/shared';
import { createPostSchema } from '@portfolio/shared';
import { CalendarClock, Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  generateSlug,
  useAdminTags,
  useCreatePost,
  useUpdatePost,
} from '@/hooks/use-admin-queries';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';
import { CreateTagDialogForm } from './CreateTagDialogForm';
import { MarkdownEditor } from './MarkdownEditor';

// Use the Zod INPUT type (pre-transform) for the form's internal state.
// The resolver returns the OUTPUT type (Post transforms) to `onSubmit`.
type PostFormValues = z.input<typeof createPostSchema>;

interface PostFormProps {
  mode: 'create' | 'edit';
  post?: Post;
}

export function PostForm({ mode, post }: PostFormProps) {
  const router = useRouter();
  const { data: allTags = [], isLoading: tagsLoading } = useAdminTags();
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost(post?.id ?? 0, post?.slug);

  const [autoSlug, setAutoSlug] = useState(mode === 'create');
  const [createTagOpen, setCreateTagOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(createPostSchema) as Resolver<PostFormValues>,
    defaultValues: {
      title: post?.title ?? '',
      slug: post?.slug ?? '',
      content: post?.content ?? '',
      excerpt: post?.excerpt ?? '',
      coverUrl: post?.coverUrl ?? '',
      status: post?.status ?? 'draft',
      tagIds: post?.tags?.map((t) => t.id) ?? [],
      // Raw ISO UTC string from post (Zod validates + transforms to Date on submit)
      scheduledAt: post?.scheduledAt ?? undefined,
    },
  });

  const title = watch('title');
  const content = watch('content');
  const selectedTagIds = watch('tagIds') ?? [];
  const watchedStatus = watch('status');
  const watchedScheduledAt = watch('scheduledAt');

  /**
   * Convert a UTC ISO string (from RHF form state) to a datetime-local compatible
   * string (local timezone, slice 0–16: "YYYY-MM-DDTHH:MM").
   */
  function toDatetimeLocal(utcIso: string | undefined): string {
    if (!utcIso) return '';
    try {
      const d = new Date(utcIso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }

  /**
   * Handle datetime-local input change: convert local time → UTC ISO and
   * store in RHF form so Zod can validate + transform it.
   */
  function handleScheduledAtChange(localValue: string) {
    if (localValue) {
      setValue('scheduledAt', new Date(localValue).toISOString(), { shouldValidate: true });
    } else {
      setValue('scheduledAt', undefined, { shouldValidate: true });
    }
  }

  // Auto-generate slug from title (only in create mode or when user hasn't manually set it)
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

  async function onSubmit(rawValues: PostFormValues) {
    // zodResolver transforms scheduledAt (string → Date) at runtime, but
    // TypeScript sees it as string | undefined (the form input type).
    // `new Date(value)` handles both strings and Date objects correctly.
    const scheduledAtIso = rawValues.scheduledAt
      ? new Date(rawValues.scheduledAt as string).toISOString()
      : undefined;

    const payload = {
      ...rawValues,
      coverUrl: rawValues.coverUrl || undefined,
      excerpt: rawValues.excerpt || undefined,
      slug: rawValues.slug || undefined,
      scheduledAt: scheduledAtIso,
    };

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(
          payload as Parameters<typeof createMutation.mutateAsync>[0]
        );
        router.push('/admin/posts');
      } else if (post) {
        await updateMutation.mutateAsync(
          payload as Parameters<typeof updateMutation.mutateAsync>[0]
        );
        router.push('/admin/posts');
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
          placeholder="Título do post"
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
          placeholder="meu-post-aqui"
          readOnly={autoSlug}
          className={cn(
            'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm',
            'focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60',
            autoSlug && 'text-zinc-500 cursor-default'
          )}
        />
        {errors.slug && <p className="text-xs text-red-400">{errors.slug.message}</p>}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-sm">
          Conteúdo <span className="text-red-400">*</span>
        </Label>
        <MarkdownEditor value={content} onChange={(v) => setValue('content', v)} minHeight={400} />
        {errors.content && <p className="text-xs text-red-400">{errors.content.message}</p>}
      </div>

      {/* Excerpt */}
      <div className="space-y-2">
        <Label htmlFor="excerpt" className="text-zinc-300 text-sm">
          Resumo
          <span className="text-zinc-600 text-xs ml-2">(usado em listagens)</span>
        </Label>
        <Textarea
          id="excerpt"
          {...register('excerpt')}
          placeholder="Breve resumo do post..."
          rows={3}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.excerpt && <p className="text-xs text-red-400">{errors.excerpt.message}</p>}
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

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-sm">Status</Label>
        <Select
          defaultValue={post?.status ?? 'draft'}
          onValueChange={(v) => setValue('status', v as 'draft' | 'published' | 'scheduled')}
        >
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/40">
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
            <SelectItem
              value="scheduled"
              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
            >
              Agendado
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Scheduled At — shown only when status = 'scheduled' */}
      {watchedStatus === 'scheduled' && (
        <div className="space-y-2">
          <Label htmlFor="scheduledAt" className="text-zinc-300 text-sm flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
            Data e hora de publicação
            <span className="text-zinc-500 text-xs ml-1">(horário local)</span>
          </Label>
          <Input
            id="scheduledAt"
            type="datetime-local"
            value={toDatetimeLocal(watchedScheduledAt)}
            onChange={(e) => handleScheduledAtChange(e.target.value)}
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60 w-fit"
          />
          {watchedStatus === 'scheduled' && !watchedScheduledAt && (
            <p className="text-xs text-amber-400">Selecione uma data e hora futura para agendar</p>
          )}
          {errors.scheduledAt && (
            <p className="text-xs text-red-400">{errors.scheduledAt.message as string}</p>
          )}
        </div>
      )}

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
          {isPending ? 'Salvando...' : mode === 'create' ? 'Criar post' : 'Salvar alterações'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/posts')}
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
