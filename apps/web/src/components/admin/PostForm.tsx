'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreatePostInput,
  createPostSchema,
  generateSlug,
  type Post,
  type Tag,
} from '@portfolio/shared';
import { CalendarClock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Control, FieldError, UseFormSetValue } from 'react-hook-form';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { useCreatePost, useUpdatePost } from '@/hooks/admin/use-admin-posts';
import { useAdminTags } from '@/hooks/admin/use-admin-tags';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { CoverMediaField } from './CoverMediaField';
import { CreateTagDialogForm } from './CreateTagDialogForm';
import { MarkdownEditor } from './MarkdownEditor';
import { PostGenerationAssistant } from './PostGenerationAssistant';
import { TagCheckboxGroup } from './TagCheckboxGroup';

// Use the Zod INPUT type (pre-transform) for the form's internal state.
// The resolver returns the OUTPUT type (Post transforms) to `onSubmit`.
type PostFormValues = z.input<typeof createPostSchema>;

/**
 * Convert a UTC ISO string to a datetime-local compatible string
 * (local timezone, slice 0–16: "YYYY-MM-DDTHH:MM").
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

function ScheduledAtSection({
  control,
  setValue,
  error,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: RHF zodResolver widens TContext to `unknown`; `any` lets the prop accept both
  control: Control<PostFormValues, any, any>;
  setValue: UseFormSetValue<PostFormValues>;
  error: FieldError | undefined;
}) {
  const status = useWatch({ control, name: 'status' });
  const scheduledAt = useWatch({ control, name: 'scheduledAt' });

  if (status !== 'scheduled') return null;

  function handleScheduledAtChange(localValue: string) {
    if (localValue) {
      setValue('scheduledAt', new Date(localValue).toISOString(), { shouldValidate: true });
    } else {
      setValue('scheduledAt', undefined, { shouldValidate: true });
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="scheduledAt" className="text-zinc-300 text-sm flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
        Data e hora de publicação
        <span className="text-zinc-500 text-xs ml-1">(horário local)</span>
      </Label>
      <Input
        id="scheduledAt"
        type="datetime-local"
        value={toDatetimeLocal(scheduledAt)}
        onChange={(e) => handleScheduledAtChange(e.target.value)}
        min={toDatetimeLocal(new Date(Date.now() + 60_000).toISOString())}
        className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60 w-fit"
      />
      {!scheduledAt && (
        <p className="text-xs text-amber-400">Selecione uma data e hora futura para agendar</p>
      )}
      {error && <p className="text-xs text-red-400">{error.message as string}</p>}
    </div>
  );
}

function toPostPayload(values: CreatePostInput): CreatePostInput {
  return {
    ...values,
    coverUrl: values.coverUrl || undefined,
    excerpt: values.excerpt || undefined,
    slug: values.slug || undefined,
  };
}

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
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues, unknown, CreatePostInput>({
    resolver: zodResolver(createPostSchema),
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

  const titleField = register('title');
  const [assistantTitle, assistantSlug, assistantExcerpt, assistantContent, assistantTagIds] =
    useWatch({
      control,
      name: ['title', 'slug', 'excerpt', 'content', 'tagIds'],
    });

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

  async function onSubmit(values: CreatePostInput) {
    const payload = toPostPayload(values);

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
        router.push('/admin/posts');
      } else if (post) {
        await updateMutation.mutateAsync(payload);
        router.push('/admin/posts');
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
      {/* AI generation assistant — create mode only */}
      {mode === 'create' && (
        <PostGenerationAssistant
          setValue={setValue}
          allTags={allTags}
          currentValues={{
            title: assistantTitle ?? '',
            slug: assistantSlug ?? '',
            excerpt: assistantExcerpt ?? '',
            content: assistantContent ?? '',
            tagIds: assistantTagIds ?? [],
          }}
          onTagsApplied={(tagIds) => setValue('tagIds', tagIds)}
        />
      )}

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
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <MarkdownEditor value={field.value} onChange={field.onChange} minHeight={400} />
          )}
        />
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
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none overflow-y-auto field-sizing-fixed focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
        />
        {errors.excerpt && <p className="text-xs text-red-400">{errors.excerpt.message}</p>}
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
      <ScheduledAtSection control={control} setValue={setValue} error={errors.scheduledAt} />

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
