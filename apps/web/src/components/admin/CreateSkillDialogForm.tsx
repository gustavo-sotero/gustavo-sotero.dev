'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { generateSlug, type Skill, type SkillCategory } from '@portfolio/shared';
import { Check, Info, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { useCreateSkill } from '@/hooks/admin/use-admin-skills';
import {
  ALL_SKILL_CATEGORIES,
  CATEGORY_LABELS,
  findSkillCatalogEntryByName,
  type PredefinedSkillSuggestion,
  searchAllSkillSuggestions,
} from '@/lib/skill-catalog';

const EXPERTISE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Básico',
  2: 'Intermediário',
  3: 'Avançado',
};

const createSkillDialogSchema = z
  .object({
    name: z.string().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres').trim(),
    category: z.enum(ALL_SKILL_CATEGORIES).or(z.literal('')),
    expertiseLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
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

type CreateSkillDialogInput = z.infer<typeof createSkillDialogSchema>;

export interface CreateSkillDialogFormProps {
  open: boolean;
  onClose: () => void;
  onSkillCreated?: (skill: Skill) => void;
}

export function CreateSkillDialogForm({
  open,
  onClose,
  onSkillCreated,
}: CreateSkillDialogFormProps) {
  const create = useCreateSkill();
  const [rawName, setRawName] = useState('');
  const [matchedEntry, setMatchedEntry] = useState<PredefinedSkillSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suppressBlurRef = useRef(false);

  const isMapped = matchedEntry !== null;

  const {
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateSkillDialogInput>({
    resolver: zodResolver(createSkillDialogSchema),
    defaultValues: {
      name: '',
      category: '',
      expertiseLevel: 2,
      isHighlighted: false,
    },
  });

  const selectedCategory = watch('category');
  const nameValue = watch('name');
  const effectiveCategory = matchedEntry?.category ?? selectedCategory;
  const suggestions = searchAllSkillSuggestions(rawName, 8);

  function handleNameInput(value: string) {
    setRawName(value);
    setValue('name', value, { shouldDirty: true, shouldValidate: false });

    const entry = findSkillCatalogEntryByName(value);
    if (entry) {
      setMatchedEntry(entry);
      setValue('category', entry.category, { shouldDirty: true });
    } else {
      setMatchedEntry(null);
    }

    const filtered = searchAllSkillSuggestions(value, 8);
    setShowSuggestions(value.length > 0 && filtered.length > 0);
  }

  function handleSelectSuggestion(suggestion: PredefinedSkillSuggestion) {
    suppressBlurRef.current = true;
    setRawName(suggestion.name);
    setMatchedEntry(suggestion);
    setValue('name', suggestion.name, { shouldDirty: true });
    setValue('category', suggestion.category, { shouldDirty: true });
    setShowSuggestions(false);
    setTimeout(() => {
      suppressBlurRef.current = false;
    }, 0);
  }

  function handleCategoryChange(category: SkillCategory) {
    setValue('category', category, { shouldDirty: true });
  }

  function handleNameBlur() {
    setTimeout(() => {
      if (!suppressBlurRef.current) {
        setShowSuggestions(false);
      }
    }, 150);
  }

  function handleClose() {
    reset({
      name: '',
      category: '',
      expertiseLevel: 2,
      isHighlighted: false,
    });
    setRawName('');
    setMatchedEntry(null);
    setShowSuggestions(false);
    onClose();
  }

  async function onSubmit(data: CreateSkillDialogInput) {
    if (!effectiveCategory) return;

    const result = await create.mutateAsync({
      name: data.name.trim(),
      category: effectiveCategory as SkillCategory,
      expertiseLevel: data.expertiseLevel,
      isHighlighted: data.isHighlighted,
    });
    reset({
      name: '',
      category: '',
      expertiseLevel: 2,
      isHighlighted: false,
    });
    setRawName('');
    setMatchedEntry(null);
    setShowSuggestions(false);
    if (result?.data) onSkillCreated?.(result.data);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Criar skill</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Informe o nome da tecnologia para sugerir categoria automaticamente ou escolha
            manualmente.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.stopPropagation();
            return handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="create-skill-dialog-name">
              Nome <span className="text-red-400">*</span>
            </Label>

            <div className="relative">
              <Input
                id="create-skill-dialog-name"
                value={rawName}
                onChange={(e) => handleNameInput(e.target.value)}
                onFocus={() => {
                  if (rawName.length > 0 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={handleNameBlur}
                placeholder="ex: TypeScript, React, Redis..."
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={showSuggestions ? 'create-skill-dialog-suggestions' : undefined}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  id="create-skill-dialog-suggestions"
                  role="listbox"
                  aria-label="Sugestões"
                  className="absolute z-50 top-full mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-52 overflow-y-auto"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.name}
                      role="option"
                      type="button"
                      aria-selected={rawName === suggestion.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(suggestion);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors text-left gap-3"
                    >
                      <span className="font-medium">{suggestion.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-medium capitalize">
                          {CATEGORY_LABELS[suggestion.category]}
                        </span>
                        <code className="text-xs text-zinc-600 font-mono truncate max-w-28">
                          {suggestion.iconKey}
                        </code>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            {nameValue && <p className="text-xs text-zinc-500">Slug: {generateSlug(nameValue)}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="create-skill-dialog-category">
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
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => handleCategoryChange(value as SkillCategory)}
                  >
                    <SelectTrigger
                      id="create-skill-dialog-category"
                      className="bg-zinc-800 border-zinc-700 text-zinc-100"
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {ALL_SKILL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
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
                Sem mapeamento conhecido: selecione uma categoria. O icone sera definido
                automaticamente pelo fallback da categoria no backend.
              </p>
            )}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-zinc-300">
              Nível de expertise <span className="text-red-400">*</span>
            </legend>
            <Controller
              name="expertiseLevel"
              control={control}
              render={({ field }) => (
                <div role="radiogroup" aria-label="Nível de expertise" className="flex gap-3">
                  {([1, 2, 3] as const).map((level) => (
                    <label
                      key={level}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="radio"
                        name="expertiseLevel"
                        value={level}
                        checked={field.value === level}
                        onChange={() => field.onChange(level)}
                        className="accent-emerald-500"
                        aria-label={EXPERTISE_LABELS[level]}
                      />
                      <span className="text-sm text-zinc-300">{EXPERTISE_LABELS[level]}</span>
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.expertiseLevel && (
              <p className="text-xs text-red-400">{errors.expertiseLevel.message}</p>
            )}
          </fieldset>

          <div className="flex items-center justify-between">
            <Label htmlFor="create-skill-dialog-highlighted" className="text-zinc-300">
              Destacada
            </Label>
            <Controller
              name="isHighlighted"
              control={control}
              render={({ field }) => (
                <Switch
                  id="create-skill-dialog-highlighted"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !effectiveCategory || !nameValue.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {create.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Criar skill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
