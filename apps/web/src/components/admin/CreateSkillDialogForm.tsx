'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { generateSlug, type Skill, type SkillCategory } from '@portfolio/shared';
import { Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Switch } from '@/components/ui/switch';
import { useCreateSkill } from '@/hooks/admin/use-admin-skills';

const SKILL_CATEGORIES: SkillCategory[] = ['language', 'framework', 'tool', 'db', 'cloud', 'infra'];

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de Dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
};

const EXPERTISE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Básico',
  2: 'Intermediário',
  3: 'Avançado',
};

const createSkillDialogSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres').trim(),
  category: z.enum(['language', 'framework', 'tool', 'db', 'cloud', 'infra'] as const),
  expertiseLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  isHighlighted: z.boolean(),
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

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateSkillDialogInput>({
    resolver: zodResolver(createSkillDialogSchema),
    defaultValues: {
      name: '',
      category: 'language',
      expertiseLevel: 2,
      isHighlighted: false,
    },
  });

  const nameValue = watch('name');

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(data: CreateSkillDialogInput) {
    const result = await create.mutateAsync(data);
    reset();
    if (result?.data) onSkillCreated?.(result.data);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Criar skill</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-skill-dialog-name">
              Nome <span className="text-red-400">*</span>
            </Label>
            <Input
              id="create-skill-dialog-name"
              placeholder="ex: TypeScript"
              {...register('name')}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            {nameValue && <p className="text-xs text-zinc-500">Slug: {generateSlug(nameValue)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>
              Categoria <span className="text-red-400">*</span>
            </Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {SKILL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
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
              disabled={create.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar skill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
