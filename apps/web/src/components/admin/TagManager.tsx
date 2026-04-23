'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { generateSlug, type TagCategory, type Tag as TagType } from '@portfolio/shared';
import { Check, Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateTagDialogForm } from '@/components/admin/CreateTagDialogForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminTags,
  useCreateTag,
  useDeleteTag,
  useUpdateTag,
} from '@/hooks/admin/use-admin-tags';
import {
  ALL_TAG_CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getSuggestionsByCategory,
  type PredefinedTagSuggestion,
  searchSuggestions,
} from '@/lib/tag-catalog';

// Schema used only for EditTagDialog (CreateTagDialogForm has its own schema)
const editTagSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100).trim(),
  category: z.enum(ALL_TAG_CATEGORIES),
});

type EditTagInput = z.infer<typeof editTagSchema>;

export function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category as TagCategory] ?? CATEGORY_COLORS.other;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {CATEGORY_LABELS[category as TagCategory] ?? category}
    </span>
  );
}

function TagRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-28 bg-zinc-800" />
        <Skeleton className="h-5 w-20 bg-zinc-800 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-3 w-3 bg-zinc-800 rounded-full" />
        <Skeleton className="h-7 w-7 bg-zinc-800 rounded" />
        <Skeleton className="h-7 w-7 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

// ─── Edit Tag Dialog ──────────────────────────────────────────────────────────
// Category-first + name combobox with suggestions, same UX as creation.

function EditTagDialog({
  tag,
  open,
  onClose,
}: {
  tag: TagType;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateTag();
  const [nameInput, setNameInput] = useState(tag.name);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suppressBlurRef = useRef(false);

  const {
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<EditTagInput>({
    resolver: zodResolver(editTagSchema),
    defaultValues: {
      name: tag.name,
      category: tag.category as EditTagInput['category'],
    },
  });

  const selectedCategory = watch('category');
  const nameValue = watch('name');
  const suggestions = getSuggestionsByCategory(selectedCategory);
  const filtered = searchSuggestions(suggestions, nameInput).slice(0, 8);

  function handleCategoryChange(category: TagCategory) {
    setValue('category', category, { shouldDirty: true });
    // Preserve name when editing — don't clear on category change
    setShowSuggestions(false);
  }

  function handleNameInput(value: string) {
    setNameInput(value);
    setValue('name', value, { shouldDirty: true, shouldValidate: false });
    setShowSuggestions(value.length > 0 && filtered.length > 0);
  }

  function handleSelectSuggestion(suggestion: PredefinedTagSuggestion) {
    suppressBlurRef.current = true;
    setNameInput(suggestion.name);
    setValue('name', suggestion.name, { shouldDirty: true });
    setShowSuggestions(false);
    setTimeout(() => {
      suppressBlurRef.current = false;
    }, 0);
  }

  function handleNameBlur() {
    setTimeout(() => {
      if (!suppressBlurRef.current) setShowSuggestions(false);
    }, 150);
  }

  async function onSubmit(data: EditTagInput) {
    try {
      await update.mutateAsync({
        id: tag.id,
        data: {
          name: data.name.trim(),
          category: data.category,
        },
      });
      onClose();
    } catch {
      // swallow unexpected errors — the mutation hook handles toast/logging
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Editar Tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tag-category" className="text-xs text-zinc-400">
              Categoria *
            </Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => handleCategoryChange(v as TagCategory)}
                >
                  <SelectTrigger
                    id="edit-tag-category"
                    className="border-zinc-700 bg-zinc-800 text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500/20"
                  >
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {ALL_TAG_CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
          </div>

          {/* Name with suggestion dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tag-name" className="text-xs text-zinc-400">
              Nome *
            </Label>
            <div className="relative">
              <Input
                id="edit-tag-name"
                value={nameInput}
                onChange={(e) => handleNameInput(e.target.value)}
                onFocus={() => {
                  if (nameInput.length > 0 && filtered.length > 0) setShowSuggestions(true);
                }}
                onBlur={handleNameBlur}
                autoComplete="off"
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
              {showSuggestions && filtered.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Sugestões"
                  className="absolute z-50 top-full mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-52 overflow-y-auto"
                >
                  {filtered.map((s) => (
                    <button
                      key={s.name}
                      role="option"
                      type="button"
                      aria-selected={nameInput === s.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(s);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors text-left gap-3"
                    >
                      <span className="font-medium">{s.name}</span>
                      <code className="text-xs text-zinc-600 font-mono truncate max-w-35">
                        {s.iconKey}
                      </code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {nameValue && (
              <p className="text-xs text-zinc-600">
                Slug: <span className="font-mono text-zinc-500">{generateSlug(nameValue)}</span>
              </p>
            )}
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-zinc-400"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={update.isPending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {update.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TagManager() {
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useAdminTags();
  const deleteTag = useDeleteTag();

  const tags: TagType[] = data ?? [];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-zinc-400" />
          <span className="text-sm text-zinc-400">
            {Array.isArray(tags) ? `${tags.length} tag${tags.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white h-8"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Tag
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Nome
          </div>
          <div className="w-32 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Categoria
          </div>
          <div className="w-44 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Icon Key
          </div>
          <div className="w-20 text-xs font-medium text-zinc-500 uppercase tracking-wide text-right">
            Ações
          </div>
        </div>

        {isLoading ? (
          (['sk1', 'sk2', 'sk3', 'sk4', 'sk5', 'sk6'] as const).map((sk) => (
            <TagRowSkeleton key={sk} />
          ))
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-zinc-500">Falha ao carregar tags</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-xs text-zinc-400"
            >
              Tentar novamente
            </Button>
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Tag className="h-7 w-7 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhuma tag cadastrada</p>
          </div>
        ) : (
          tags.map((tag: TagType) => (
            <div
              key={tag.id}
              className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{tag.name}</p>
                <p className="text-xs font-mono text-zinc-600 truncate">{tag.slug}</p>
              </div>
              <div className="w-32">
                <CategoryBadge category={tag.category} />
              </div>
              <div className="w-44">
                {tag.iconKey ? (
                  <code className="text-xs text-zinc-400 font-mono truncate block">
                    {tag.iconKey}
                  </code>
                ) : (
                  <span className="text-xs text-zinc-700">—</span>
                )}
              </div>
              <div className="w-20 flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                  onClick={() => setEditingTag(tag)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-100">Excluir tag?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        A tag <strong className="text-zinc-300">{tag.name}</strong> será removida de
                        todos os posts e projetos. Esta ação é irreversível.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => deleteTag.mutate(tag.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Tag Dialog */}
      <CreateTagDialogForm open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />

      {/* Edit Tag Dialog */}
      {editingTag && (
        <EditTagDialog tag={editingTag} open={true} onClose={() => setEditingTag(null)} />
      )}
    </div>
  );
}
