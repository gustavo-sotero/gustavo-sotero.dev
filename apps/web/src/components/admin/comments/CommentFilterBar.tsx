'use client';

import type { CommentStatus } from '@portfolio/shared';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';

const STATUS_TABS: { value: CommentStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendentes', color: 'text-amber-400' },
  { value: 'approved', label: 'Aprovados', color: 'text-emerald-400' },
  { value: 'rejected', label: 'Rejeitados', color: 'text-red-400' },
];

interface CommentFilterBarProps {
  status: CommentStatus;
  onStatusChange: (status: CommentStatus) => void;
  showDeleted: boolean;
  onToggleDeleted: () => void;
  total: number | undefined;
}

export function CommentFilterBar({
  status,
  onStatusChange,
  showDeleted,
  onToggleDeleted,
  total,
}: CommentFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onStatusChange(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              status === tab.value
                ? `bg-zinc-800 ${tab.color}`
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleDeleted}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showDeleted
              ? 'border-red-900/50 bg-red-950/20 text-red-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {showDeleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showDeleted ? 'Excluídos visíveis' : 'Ocultar excluídos'}
        </button>

        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MessageSquare className="h-3.5 w-3.5" />
          {total !== undefined ? `${total} resultado${total !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
    </div>
  );
}
