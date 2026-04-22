'use client';

import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const MAX_FACTS = 6;
const MAX_FACT_LENGTH = 200;

type ImpactFactItem = {
  id: string;
  value: string;
};

let nextImpactFactId = 0;

function createImpactFactItem(value: string): ImpactFactItem {
  nextImpactFactId += 1;
  return {
    id: `impact-fact-${nextImpactFactId}`,
    value,
  };
}

interface ImpactFactsEditorProps {
  value: string[];
  onChange: (facts: string[]) => void;
  error?: string;
}

/**
 * Repeatable editor for impact facts.
 *
 * Rules enforced locally (mirrors shared Zod schema):
 * – Max 6 facts
 * – Each fact max 200 chars
 * – Empty strings are filtered before emitting onChange
 */
export function ImpactFactsEditor({ value, onChange, error }: ImpactFactsEditorProps) {
  // Internal state keeps stable string[] including transient empty strings
  // while the user is typing. onChange only fires with trimmed non-empty values.
  const [items, setItems] = useState<ImpactFactItem[]>(() => value.map(createImpactFactItem));
  const addedRef = useRef(false);

  // Sync from parent (e.g. edit mode loading)
  useEffect(() => {
    if (!addedRef.current) {
      setItems(value.map(createImpactFactItem));
    }
  }, [value]);

  function emit(next: ImpactFactItem[]) {
    const cleaned = next.map((item) => item.value.trim()).filter((fact) => fact.length > 0);
    onChange(cleaned);
  }

  function handleChange(index: number, nextValue: string) {
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, value: nextValue } : item
    );
    setItems(next);
    emit(next);
  }

  function handleAdd() {
    if (items.length >= MAX_FACTS) return;
    addedRef.current = true;
    const next = [...items, createImpactFactItem('')];
    setItems(next);
    // Don't emit empty string — will be emitted when user types
  }

  function handleRemove(index: number) {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    emit(next);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-zinc-300 text-sm">
            Fatos de Impacto
            <span className="text-zinc-600 text-xs ml-2">(máx. {MAX_FACTS})</span>
          </Label>
          <p className="text-xs text-zinc-600 mt-0.5">
            Use verbo forte + resultado. Prefira métricas (ex: "Reduziu latência em 40%").
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={items.length >= MAX_FACTS}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
            items.length < MAX_FACTS
              ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
              : 'border-zinc-700 text-zinc-600 cursor-not-allowed'
          )}
          aria-label="Adicionar fato de impacto"
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {/* Hint when empty */}
      {items.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/40 px-4 py-3">
          <Lightbulb className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-600 leading-relaxed">
            Nenhum fato adicionado. Exemplos:{' '}
            <span className="text-zinc-500">"Reduziu tempo de deploy em 60%"</span>,{' '}
            <span className="text-zinc-500">"Adotado por +200 clientes em 30 dias"</span>.
          </p>
        </div>
      )}

      {/* Fact list */}
      {items.length > 0 && (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 font-mono w-5 text-right shrink-0">
                {index + 1}.
              </span>
              <div className="relative flex-1">
                <Input
                  value={item.value}
                  onChange={(e) => handleChange(index, e.target.value)}
                  placeholder="Verbo + resultado mensurável..."
                  maxLength={MAX_FACT_LENGTH}
                  aria-label={`Fato de impacto ${index + 1}`}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60 pr-12 text-sm"
                />
                {item.value.length > MAX_FACT_LENGTH * 0.8 && (
                  <span
                    className={cn(
                      'absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-mono',
                      item.value.length >= MAX_FACT_LENGTH ? 'text-red-400' : 'text-zinc-500'
                    )}
                  >
                    {MAX_FACT_LENGTH - item.value.length}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                className="h-8 w-8 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                aria-label={`Remover fato ${index + 1}`}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
