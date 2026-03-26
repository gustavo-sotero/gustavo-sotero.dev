'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { generateSlug, type Tag, type TagCategory } from '@portfolio/shared';
import { Check, Info, Loader2, Star } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';
import { useAdminTags, useCreateTag } from '@/hooks/admin/use-admin-tags';
import {
  ALL_TAG_CATEGORIES,
  CATEGORY_LABELS,
  findCatalogEntryByName,
  type PredefinedTagSuggestion,
  searchAllSuggestions,
} from '@/lib/tag-catalog';

const createTagDialogSchema = z
  .object({
    name: z.string().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres').trim(),
    category: z.enum(ALL_TAG_CATEGORIES).or(z.literal('')),
    isHighlighted: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.category === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Categoria obrigatória',
      });
    }
  });

type CreateTagDialogInput = z.infer<typeof createTagDialogSchema>;

export interface CreateTagDialogFormProps {
  open: boolean;
  onClose: () => void;
  onTagCreated?: (tag: Tag) => void;
  /**
   * Optional initial category selection. Only applied when no catalog entry
   * matches the typed name (unmapped mode). Ignored when a mapped suggestion
   * is selected — the catalog-defined category takes precedence.
   */
  defaultCategory?: TagCategory;
}

export function CreateTagDialogForm({
  open,
  onClose,
  onTagCreated,
  defaultCategory,
}: CreateTagDialogFormProps) {
  const create = useCreateTag();

  const [rawName, setRawName] = useState('');
  const [matchedEntry, setMatchedEntry] = useState<PredefinedTagSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const [highlightLimitError, setHighlightLimitError] = useState('');
  const suppressBlurRef = useRef(false);

  /** True when the current name matches a predefined catalog entry. */
  const isMapped = matchedEntry !== null;

  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateTagDialogInput>({
    resolver: zodResolver(createTagDialogSchema),
    defaultValues: {
      name: '',
      category: defaultCategory ?? '',
      isHighlighted: false,
    },
  });

  const selectedCategory = watch('category');
  const nameValue = watch('name');
  const effectiveCategory = matchedEntry?.category ?? selectedCategory;
  const { data: existingTags = [] } = useAdminTags(selectedCategory || undefined);

  // Cross-category suggestions filtered by current input
  const suggestions = searchAllSuggestions(rawName, 8);

  function handleNameInput(value: string) {
    setRawName(value);
    setValue('name', value, { shouldDirty: true, shouldValidate: false });
    setConflictError('');
    setHighlightLimitError('');

    // Exact match check: auto-fill and lock category when a catalog entry matches
    const entry = findCatalogEntryByName(value);
    if (entry) {
      setMatchedEntry(entry);
      setValue('category', entry.category, { shouldDirty: true });
    } else {
      setMatchedEntry(null);
      // Preserve any manually-selected category when deselecting
    }

    const filtered = searchAllSuggestions(value, 8);
    setShowSuggestions(value.length > 0 && filtered.length > 0);
  }

  function handleSelectSuggestion(suggestion: PredefinedTagSuggestion) {
    suppressBlurRef.current = true;
    setRawName(suggestion.name);
    setMatchedEntry(suggestion);
    setValue('name', suggestion.name, { shouldDirty: true });
    setValue('category', suggestion.category, { shouldDirty: true });
    setShowSuggestions(false);
    setConflictError('');
    setHighlightLimitError('');
    setTimeout(() => {
      suppressBlurRef.current = false;
    }, 0);
  }

  function handleCategoryChange(category: TagCategory) {
    setValue('category', category, { shouldDirty: true });
    setConflictError('');
    setHighlightLimitError('');
  }

  function handleNameBlur() {
    setTimeout(() => {
      if (!suppressBlurRef.current) {
        setShowSuggestions(false);
      }
    }, 150);
  }

  async function onSubmit(data: CreateTagDialogInput) {
    if (!effectiveCategory) return;

    setConflictError('');
    setHighlightLimitError('');
    try {
      const result = await create.mutateAsync({
        name: data.name.trim(),
        category: effectiveCategory,
        isHighlighted: data.isHighlighted,
      });
      onTagCreated?.(result?.data as Tag);
      handleClose();
    } catch (err) {
      const apiErr = err as { error?: { code?: string; message?: string } };
      if (apiErr?.error?.code === 'CONFLICT') {
        if (apiErr.error.message?.includes('destacadas')) {
          setHighlightLimitError(
            'Máximo de 2 destaques por categoria atingido. Remova um destaque existente antes de adicionar outro.'
          );
          return;
        }

        const normalized = data.name.trim().toLowerCase();
        const existing = existingTags.find((tag) => tag.name.trim().toLowerCase() === normalized);

        if (existing) {
          onTagCreated?.(existing);
          toast.warning('Tag já existente selecionada automaticamente.');
          handleClose();
          return;
        }

        setConflictError(
          'Já existe uma tag com este nome. Selecione a existente ou use outro nome.'
        );
      }
    }
  }

  function handleClose() {
    reset({ name: '', category: defaultCategory ?? '', isHighlighted: false });
    setRawName('');
    setMatchedEntry(null);
    setShowSuggestions(false);
    setConflictError('');
    setHighlightLimitError('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Nova Tag</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Informe o nome da tecnologia para sugerir categoria automaticamente ou escolha
            manualmente.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            // Stop the event from bubbling up through the React component tree to any
            // parent <form> (e.g. PostForm / ProjectForm). Even though Radix Dialog uses
            // a DOM portal, React synthetic events propagate via the virtual tree.
            e.stopPropagation();
            return handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          {/* ── 1. Name field — always enabled, name-first ───────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="ctdf-name" className="text-xs text-zinc-400">
              Nome <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="ctdf-name"
                value={rawName}
                onChange={(e) => handleNameInput(e.target.value)}
                onFocus={() => {
                  if (rawName.length > 0 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={handleNameBlur}
                placeholder="ex: TypeScript, Redis, Docker…"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={showSuggestions ? 'ctdf-suggestions' : undefined}
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  id="ctdf-suggestions"
                  role="listbox"
                  aria-label="Sugestões"
                  className="absolute z-50 top-full mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-52 overflow-y-auto"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      role="option"
                      type="button"
                      aria-selected={rawName === s.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(s);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors text-left gap-3"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-medium capitalize">
                          {CATEGORY_LABELS[s.category]}
                        </span>
                        <code className="text-xs text-zinc-600 font-mono truncate max-w-28">
                          {s.iconKey}
                        </code>
                      </span>
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
            {conflictError && <p className="text-xs text-amber-400">{conflictError}</p>}
          </div>

          {/* ── 2. Category — auto-locked when mapped, manual when unmapped ─ */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="ctdf-category" className="text-xs text-zinc-400">
                Categoria <span className="text-red-400">*</span>
              </Label>
              {isMapped && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <Info className="h-2.5 w-2.5" />
                  Definido automaticamente
                </span>
              )}
            </div>

            {isMapped ? (
              <output
                aria-label="Categoria definida automaticamente"
                className="flex items-center h-9 px-3 rounded-md border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-sm cursor-default select-none w-full"
              >
                {selectedCategory
                  ? CATEGORY_LABELS[selectedCategory as keyof typeof CATEGORY_LABELS]
                  : ''}
              </output>
            ) : (
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => handleCategoryChange(v as TagCategory)}
                  >
                    <SelectTrigger
                      id="ctdf-category"
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
            )}

            {errors.category && !isMapped && (
              <p className="text-xs text-red-400">{errors.category.message}</p>
            )}
            {!isMapped && (
              <p className="text-[11px] text-zinc-500">
                Sem mapeamento conhecido: selecione uma categoria. O ícone será definido
                automaticamente pelo fallback da categoria no backend.
              </p>
            )}
          </div>

          {/* ── 3. Highlight toggle ───────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label
                htmlFor="ctdf-is-highlighted"
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 cursor-pointer"
              >
                <Star className="h-3.5 w-3.5 text-amber-400" />
                Destaque
              </Label>
              <p className="text-[10px] text-zinc-600">Máx. 2 por categoria</p>
            </div>
            <Controller
              control={control}
              name="isHighlighted"
              render={({ field }) => (
                <Switch
                  id="ctdf-is-highlighted"
                  checked={field.value}
                  onCheckedChange={(v) => {
                    field.onChange(v);
                    setHighlightLimitError('');
                  }}
                  className="data-[state=checked]:bg-amber-500"
                />
              )}
            />
          </div>
          {highlightLimitError && <p className="text-xs text-amber-400">{highlightLimitError}</p>}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !effectiveCategory || !nameValue.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white min-w-22.5"
            >
              {create.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Criar tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
