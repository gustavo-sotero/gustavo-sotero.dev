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

vi.mock('@portfolio/shared', async () => {
  const actual = await vi.importActual<typeof import('@portfolio/shared')>('@portfolio/shared');
  return {
    ...actual,
    generateSlug: generateSlugMock,
  };
});

vi.mock('@/hooks/admin/use-admin-tags', () => ({
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
}));

vi.mock('@/hooks/admin/use-admin-experience', () => ({
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

vi.mock('@/hooks/admin/use-admin-skills', () => ({
  useAdminSkills: () => ({
    data: [
      {
        id: 10,
        name: 'Docker',
        slug: 'docker',
        category: 'infra',
        expertiseLevel: 2,
        isHighlighted: false,
        iconKey: 'si:SiDocker',
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
        onClick={() => onChange([...value, 'Reduziu tempo de deploy em 60%'])}
      >
        Add mock fact
      </button>
    </div>
  ),
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

  it('submit payload includes impactFacts when facts are added', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    const experience: import('@portfolio/shared').Experience = {
      id: 1,
      slug: 'backend-engineer-acme',
      role: 'Backend Engineer',
      company: 'Acme',
      description: 'Responsible for APIs.',
      location: null,
      employmentType: null,
      startDate: '2022-01-01',
      endDate: '2023-06-30',
      isCurrent: false,
      order: 0,
      status: 'published',
      logoUrl: null,
      credentialUrl: null,
      impactFacts: [],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
    };

    render(<ExperienceForm mode="edit" experience={experience} />);

    fireEvent.click(screen.getByTestId('add-mock-fact'));

    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() => {
      const payload = mutateAsyncMock.mock.calls[0]?.[0];
      expect(payload?.impactFacts).toEqual(['Reduziu tempo de deploy em 60%']);
    });
  });

  it('edit mode pre-populates impactFacts from experience prop', () => {
    const experience: import('@portfolio/shared').Experience = {
      id: 2,
      slug: 'fullstack-dev-globex',
      role: 'Fullstack Developer',
      company: 'Globex',
      description: 'Built features.',
      location: null,
      employmentType: null,
      startDate: '2021-03-01',
      endDate: '2022-12-31',
      isCurrent: false,
      order: 1,
      status: 'published',
      logoUrl: null,
      credentialUrl: null,
      impactFacts: ['Liderou migração para microserviços', 'Reduziu latência em 35%'],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
    };

    render(<ExperienceForm mode="edit" experience={experience} />);

    expect(screen.getByLabelText('Fato de impacto 1')).toHaveValue(
      'Liderou migração para microserviços'
    );
    expect(screen.getByLabelText('Fato de impacto 2')).toHaveValue('Reduziu latência em 35%');
  });
});
