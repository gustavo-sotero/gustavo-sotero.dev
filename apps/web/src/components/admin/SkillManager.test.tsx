// @vitest-environment jsdom

import type { Skill } from '@portfolio/shared';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAdminSkillsMock, useCreateSkillMock, useUpdateSkillMock, useDeleteSkillMock } =
  vi.hoisted(() => ({
    useAdminSkillsMock: vi.fn(),
    useCreateSkillMock: vi.fn(),
    useUpdateSkillMock: vi.fn(),
    useDeleteSkillMock: vi.fn(),
  }));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="icon-loader" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Plus: () => <span data-testid="icon-plus" />,
  Star: () => <span data-testid="icon-star" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Zap: () => <span data-testid="icon-zap" />,
}));

vi.mock('@/hooks/admin/use-admin-skills', () => ({
  useAdminSkills: useAdminSkillsMock,
  useCreateSkill: useCreateSkillMock,
  useUpdateSkill: useUpdateSkillMock,
  useDeleteSkill: useDeleteSkillMock,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? 'button'} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

import { SkillManager } from './SkillManager';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'TypeScript',
    slug: overrides.slug ?? 'typescript',
    category: overrides.category ?? 'language',
    iconKey: overrides.iconKey ?? null,
    expertiseLevel: overrides.expertiseLevel ?? 3,
    isHighlighted: overrides.isHighlighted ?? true,
    createdAt: overrides.createdAt ?? '2026-04-23T00:00:00.000Z',
  };
}

describe('SkillManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminSkillsMock.mockReturnValue({ data: [makeSkill()], isLoading: false });
    useCreateSkillMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useUpdateSkillMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useDeleteSkillMock.mockReturnValue({ isPending: false, mutate: vi.fn() });
  });

  it('uses radio inputs for expertise in both create and edit dialogs', () => {
    render(<SkillManager />);

    expect(screen.getAllByRole('radiogroup', { name: 'Nível de expertise' })).toHaveLength(2);
    expect(screen.getAllByLabelText('Básico')).toHaveLength(2);
    expect(screen.getAllByLabelText('Intermediário')).toHaveLength(2);
    expect(screen.getAllByLabelText('Avançado')).toHaveLength(2);
  });
});
