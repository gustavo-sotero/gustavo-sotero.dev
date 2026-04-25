'use client';

import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectableChipOption {
  id: number;
  name: string;
}

interface SelectableChipGroupProps {
  label: string;
  options: SelectableChipOption[];
  selectedIds: number[];
  onToggle: (optionId: number) => void;
  onCreateOption: () => void;
  createLabel?: string;
}

export function SelectableChipGroup({
  label,
  options,
  selectedIds,
  onToggle,
  onCreateOption,
  createLabel = 'Criar item',
}: SelectableChipGroupProps) {
  const groupId = `selection-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <fieldset className="space-y-2">
      <legend id={groupId} className="flex w-full items-center justify-between gap-3 text-sm">
        <span className="text-zinc-300">{label}</span>
        <button
          type="button"
          onClick={onCreateOption}
          className="flex items-center gap-1 rounded-sm text-xs text-zinc-500 transition-colors hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Plus className="h-3 w-3" />
          {createLabel}
        </button>
      </legend>

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            const inputId = `${groupId}-${option.id}`;

            return (
              <label key={option.id} htmlFor={inputId} className="cursor-pointer">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950',
                    checked
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn('h-3 w-3', checked ? 'opacity-100' : 'opacity-40')}
                  />
                  <span>{option.name}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-500">
          Nenhum item cadastrado ainda. Use &quot;{createLabel}&quot; para adicionar o primeiro.
        </p>
      )}
    </fieldset>
  );
}
