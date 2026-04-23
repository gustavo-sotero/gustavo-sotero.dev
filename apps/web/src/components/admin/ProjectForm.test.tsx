import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Radix UI's <Switch> uses ResizeObserver; polyfill it for jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { ProjectForm } from './ProjectForm';

const pushMock = vi.fn();
const mutateAsyncMock = vi.fn();
let onTagCreatedCb:
  | ((tag: {
      id: number;
      name: string;
      slug: string;
      category: string;
      iconKey: string | null;
    }) => void)
  | undefined;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@portfolio/shared', async () => {
  const actual = await vi.importActual<typeof import('@portfolio/shared')>('@portfolio/shared');
  return {
    ...actual,
    generateSlug: () => 'projeto-de-teste',
  };
});

vi.mock('@/hooks/admin/use-admin-tags', () => ({
  useAdminTags: () => ({
    data: [{ id: 1, name: 'Docker', slug: 'docker', category: 'infra', iconKey: 'si:SiDocker' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/admin/use-admin-projects', () => ({
  useCreateProject: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useUpdateProject: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

// Mock CreateTagDialogForm to capture onTagCreated callback
vi.mock('./CreateTagDialogForm', () => ({
  CreateTagDialogForm: ({
    open,
    onClose,
    onTagCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onTagCreated?: (tag: {
      id: number;
      name: string;
      slug: string;
      category: string;
      iconKey: string | null;
    }) => void;
  }) => {
    onTagCreatedCb = onTagCreated;
    if (!open) return null;
    return (
      <div data-testid="create-tag-dialog">
        <button type="button" onClick={onClose}>
          Fechar dialog
        </button>
      </div>
    );
  },
}));

vi.mock('@/hooks/admin/use-admin-skills', () => ({
  useAdminSkills: () => ({
    data: [
      {
        id: 10,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        expertiseLevel: 2,
        isHighlighted: false,
        iconKey: 'si:SiTypescript',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('./CreateSkillDialogForm', () => ({
  CreateSkillDialogForm: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    onSkillCreated?: (skill: unknown) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="create-skill-dialog">
        <button type="button" onClick={onClose}>
          Fechar dialog skill
        </button>
      </div>
    );
  },
}));

vi.mock('./MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Conteúdo Markdown do projeto"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('./CoverMediaField', () => ({
  CoverMediaField: () => <div data-testid="cover-media-field" />,
}));

vi.mock('./ImpactFactsEditor', () => ({
  ImpactFactsEditor: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (facts: string[]) => void;
    error?: string;
  }) => (
    <div data-testid="impact-facts-editor">
      {value.map((fact, i) => (
        <input key={fact} readOnly aria-label={`Fato de impacto ${i + 1}`} value={fact} />
      ))}
      <button
        type="button"
        data-testid="add-mock-fact"
        onClick={() => onChange([...value, 'Reduziu latência em 40%'])}
      >
        Add mock fact
      </button>
    </div>
  ),
}));

describe('ProjectForm', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pushMock.mockReset();
    onTagCreatedCb = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it('does not navigate when create mutation fails', async () => {
    mutateAsyncMock.mockRejectedValue(new Error('Falha ao salvar'));

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: 'Meu projeto' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar projeto/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  // Plan §13.1.7 — Inline tag creation in ProjectForm auto-selects new tag
  it('opens create-tag dialog when Criar tag button is clicked', () => {
    render(<ProjectForm mode="create" />);

    expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Criar tag/i));

    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();
  });

  it('auto-selects newly created tag in ProjectForm and closes dialog', async () => {
    render(<ProjectForm mode="create" />);

    fireEvent.click(screen.getByText(/Criar tag/i));
    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();

    const newTag = {
      id: 88,
      name: 'Kubernetes',
      slug: 'kubernetes',
      category: 'infra',
      iconKey: 'si:SiKubernetes',
    };
    onTagCreatedCb?.(newTag);

    await waitFor(() => {
      expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();
    });
  });

  it('renders existing tags as native checkboxes', () => {
    render(<ProjectForm mode="create" />);
    expect(screen.getByRole('checkbox', { name: 'Docker' })).toBeInTheDocument();
  });

  it('auto-generates slug from title change in create mode', async () => {
    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Projeto de Teste' },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('projeto-de-teste');
    });
  });

  it('does not update slug when auto-slug is disabled', async () => {
    render(<ProjectForm mode="create" />);

    // Disable auto-slug (button text is 'Auto-gerado' when active)
    fireEvent.click(screen.getByText('Auto-gerado'));

    // Manually set a custom slug
    const slugInput = screen.getByRole('textbox', { name: /Slug/i });
    fireEvent.change(slugInput, { target: { value: 'meu-projeto-customizado' } });

    // Change the title
    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Outro Título' },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('meu-projeto-customizado');
    });
  });

  it('re-enables auto-slug and syncs slug from current title', async () => {
    render(<ProjectForm mode="create" />);

    // Type a title first
    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Meu Projeto' },
    });

    // Disable then re-enable auto-slug
    fireEvent.click(screen.getByText('Auto-gerado'));
    fireEvent.click(screen.getByText('Gerar auto'));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('projeto-de-teste');
    });
  });

  it('submit payload omits empty optional fields', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Projeto Simples' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar projeto/i }));

    await waitFor(() => {
      const payload = mutateAsyncMock.mock.calls[0]?.[0];
      expect(payload).toBeDefined();
      // Empty string coverUrl/repositoryUrl/liveUrl are coerced to undefined
      expect(payload.coverUrl).toBeUndefined();
      expect(payload.repositoryUrl).toBeUndefined();
      expect(payload.liveUrl).toBeUndefined();
    });
  });

  it('submit payload includes impactFacts when facts are added', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Projeto com Impacto' },
    });

    fireEvent.click(screen.getByTestId('add-mock-fact'));

    fireEvent.click(screen.getByRole('button', { name: /Criar projeto/i }));

    await waitFor(() => {
      const payload = mutateAsyncMock.mock.calls[0]?.[0];
      expect(payload?.impactFacts).toEqual(['Reduziu latência em 40%']);
    });
  });

  it('submit payload includes empty impactFacts array when no facts are added', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Projeto Sem Impacto' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar projeto/i }));

    await waitFor(() => {
      const payload = mutateAsyncMock.mock.calls[0]?.[0];
      expect(payload?.impactFacts).toEqual([]);
    });
  });

  it('edit mode pre-populates impactFacts from project prop', () => {
    const project: import('@portfolio/shared').Project = {
      id: 42,
      slug: 'projeto-existente',
      title: 'Projeto Existente',
      description: null,
      content: null,
      renderedContent: null,
      coverUrl: null,
      status: 'published',
      repositoryUrl: null,
      liveUrl: null,
      featured: false,
      order: 0,
      impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
    };

    render(<ProjectForm mode="edit" project={project} />);

    expect(screen.getByLabelText('Fato de impacto 1')).toHaveValue('Reduziu latência em 40%');
    expect(screen.getByLabelText('Fato de impacto 2')).toHaveValue('Adotado por +200 devs');
  });
});
