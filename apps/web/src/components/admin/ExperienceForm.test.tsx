import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceForm } from './ExperienceForm';

const { generateSlugMock } = vi.hoisted(() => ({
  generateSlugMock: vi.fn((value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  ),
}));

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
  generateSlug: generateSlugMock,
  useAdminTags: () => ({
    data: [
      {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        iconKey: 'si:SiTypescript',
      },
    ],
    isLoading: false,
  }),
  useCreateExperience: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useUpdateExperience: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

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

vi.mock('./CoverMediaField', () => ({
  CoverMediaField: () => <div data-testid="cover-media-field" />,
}));

describe('ExperienceForm', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pushMock.mockReset();
    generateSlugMock.mockClear();
    onTagCreatedCb = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it('opens create-tag dialog when Criar tag button is clicked', () => {
    render(<ExperienceForm mode="create" />);

    expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Criar tag/i));

    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();
  });

  it('auto-closes dialog when a new tag is created', async () => {
    render(<ExperienceForm mode="create" />);

    fireEvent.click(screen.getByText(/Criar tag/i));
    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();

    onTagCreatedCb?.({
      id: 99,
      name: 'Bun',
      slug: 'bun',
      category: 'tool',
      iconKey: 'si:SiBun',
    });

    await waitFor(() => {
      expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();
    });
  });

  it('renders tags as native checkboxes and toggles selection', () => {
    render(<ExperienceForm mode="create" />);

    const checkbox = screen.getByRole('checkbox', { name: 'TypeScript' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('updates slug from role and company while auto slug is enabled', () => {
    render(<ExperienceForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Cargo/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: 'Acme' } });

    expect(screen.getByLabelText('Slug')).toHaveValue('backend-engineer-acme');
    expect(generateSlugMock).toHaveBeenLastCalledWith('Backend Engineer-Acme');
  });

  it('preserves manual slug edits after auto slug is disabled', () => {
    render(<ExperienceForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Cargo/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: 'Acme' } });

    fireEvent.click(screen.getByRole('button', { name: /Auto-gerado/i }));
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'slug-manual' } });
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: 'Globex' } });

    expect(screen.getByLabelText('Slug')).toHaveValue('slug-manual');
  });

  it('blocks submit when isCurrent=false and endDate is missing', async () => {
    render(<ExperienceForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Cargo/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/Descrição/i), {
      target: { value: 'Responsável por APIs e filas.' },
    });
    fireEvent.change(screen.getByLabelText(/Data de início/i), {
      target: { value: '2024-01-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar experiência/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).not.toHaveBeenCalled();
      expect(screen.getByText(/endDate is required when isCurrent is false/i)).toBeInTheDocument();
    });
  });
});
