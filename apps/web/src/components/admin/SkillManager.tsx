'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { generateSlug, type SkillCategory, type Skill as SkillType } from '@portfolio/shared';
import { Loader2, Pencil, Plus, Star, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Switch } from '@/components/ui/switch';
import {
  useAdminSkills,
  useCreateSkill,
  useDeleteSkill,
  useUpdateSkill,
} from '@/hooks/admin/use-admin-skills';

const SKILL_CATEGORIES: SkillCategory[] = ['language', 'framework', 'tool', 'db', 'cloud', 'infra'];

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  tool: 'Ferramenta',
  db: 'Banco de Dados',
  cloud: 'Cloud',
  infra: 'Infraestrutura',
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  language: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  framework: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  tool: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  db: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cloud: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  infra: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const EXPERTISE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Básico',
  2: 'Intermediário',
  3: 'Avançado',
};

const skillFormSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100).trim(),
  category: z.enum(['language', 'framework', 'tool', 'db', 'cloud', 'infra'] as const),
  expertiseLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  isHighlighted: z.boolean(),
});

type SkillFormInput = z.infer<typeof skillFormSchema>;

function SkillExpertiseField({
  control,
  inputName,
}: {
  control: Control<SkillFormInput>;
  inputName: string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-zinc-300">Nível de expertise</legend>
      <Controller
        name="expertiseLevel"
        control={control}
        render={({ field }) => (
          <div role="radiogroup" aria-label="Nível de expertise" className="flex gap-3 flex-wrap">
            {([1, 2, 3] as const).map((level) => (
              <label key={level} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name={inputName}
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
    </fieldset>
  );
}

export function SkillCategoryBadge({ category }: { category: SkillCategory }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function SkillRowSkeleton() {
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

// ─── Edit Skill Dialog ────────────────────────────────────────────────────────

function EditSkillDialog({
  skill,
  open,
  onClose,
}: {
  skill: SkillType;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateSkill();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<SkillFormInput>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: skill.name,
      category: skill.category,
      expertiseLevel: skill.expertiseLevel,
      isHighlighted: skill.isHighlighted,
    },
  });

  async function onSubmit(data: SkillFormInput) {
    await update.mutateAsync({ id: skill.id, data });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Editar skill</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-skill-name">Nome</Label>
            <Input
              id="edit-skill-name"
              {...register('name')}
              className="bg-zinc-800 border-zinc-700"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
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
          </div>

          <SkillExpertiseField control={control} inputName={`edit-skill-expertise-${skill.id}`} />

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-skill-highlighted">Destacada</Label>
            <Controller
              name="isHighlighted"
              control={control}
              render={({ field }) => (
                <Switch
                  id="edit-skill-highlighted"
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
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || update.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Skill Form ────────────────────────────────────────────────────────

function CreateSkillForm({ onCreated }: { onCreated?: () => void }) {
  const create = useCreateSkill();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<SkillFormInput>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: '',
      category: 'language',
      expertiseLevel: 2,
      isHighlighted: false,
    },
  });

  const nameValue = watch('name');

  async function onSubmit(data: SkillFormInput) {
    await create.mutateAsync(data);
    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Nova skill
      </Button>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Criar skill</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-skill-name">Nome</Label>
            <Input
              id="create-skill-name"
              placeholder="ex: TypeScript"
              {...register('name')}
              className="bg-zinc-800 border-zinc-700"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            {nameValue && <p className="text-xs text-zinc-500">Slug: {generateSlug(nameValue)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
          </div>

          <SkillExpertiseField control={control} inputName="create-skill-expertise" />

          <div className="flex items-center justify-between">
            <Label htmlFor="create-skill-highlighted">Destacada</Label>
            <Controller
              name="isHighlighted"
              control={control}
              render={({ field }) => (
                <Switch
                  id="create-skill-highlighted"
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
              onClick={() => setOpen(false)}
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
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skill Row ────────────────────────────────────────────────────────────────

function SkillRow({ skill }: { skill: SkillType }) {
  const deleteSkill = useDeleteSkill();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-zinc-100 font-medium truncate">{skill.name}</span>
          <SkillCategoryBadge category={skill.category} />
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {EXPERTISE_LABELS[skill.expertiseLevel]}
          </span>
          {skill.isHighlighted && (
            <Star className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="sr-only">Editar</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-zinc-400 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="sr-only">Excluir</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir skill</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  Tem certeza que deseja excluir{' '}
                  <strong className="text-zinc-200">{skill.name}</strong>? Esta ação não pode ser
                  desfeita e removerá a skill de todos os projetos e experiências associados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteSkill.mutate(skill.id)}
                  className="bg-red-600 hover:bg-red-500 text-white border-0"
                >
                  {deleteSkill.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <EditSkillDialog skill={skill} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

// ─── SkillManager ─────────────────────────────────────────────────────────────

export function SkillManager() {
  const { data: skills, isLoading } = useAdminSkills();

  const grouped = SKILL_CATEGORIES.reduce<Record<string, SkillType[]>>(
    (acc, cat) => {
      acc[cat] = (skills ?? []).filter((s) => s.category === cat);
      return acc;
    },
    {} as Record<string, SkillType[]>
  );

  const hasAny = (skills?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {isLoading ? 'Carregando...' : `${skills?.length ?? 0} skill(s) cadastrada(s)`}
        </p>
        <CreateSkillForm />
      </div>

      {isLoading && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <SkillRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !hasAny && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">Nenhuma skill cadastrada ainda.</p>
          <p className="text-xs text-zinc-600 mt-1">Use o botão acima para criar a primeira.</p>
        </div>
      )}

      {!isLoading && hasAny && (
        <div className="space-y-6">
          {SKILL_CATEGORIES.filter((cat) => grouped[cat].length > 0).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <SkillCategoryBadge category={cat} />
                <span className="text-xs text-zinc-500">{grouped[cat].length}</span>
              </div>
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                {grouped[cat].map((skill) => (
                  <SkillRow key={skill.id} skill={skill} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
