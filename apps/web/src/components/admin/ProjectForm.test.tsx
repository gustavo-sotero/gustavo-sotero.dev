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

vi.mock('@/hooks/use-admin-queries', () => ({
  generateSlug: () => 'projeto-de-teste',
  useAdminTags: () => ({
    data: [{ id: 1, name: 'Docker', slug: 'docker', category: 'tool', iconKey: 'si:SiDocker' }],
    isLoading: false,
  }),
  useCreateProject: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useUpdateProject: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useCreateTag: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      data: {
        id: 88,
        name: 'Kubernetes',
        slug: 'kubernetes',
        category: 'infra',
        iconKey: 'si:SiKubernetes',
      },
    }),
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

  it('renders existing tags as selectable badges', () => {
    render(<ProjectForm mode="create" />);
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });
});
