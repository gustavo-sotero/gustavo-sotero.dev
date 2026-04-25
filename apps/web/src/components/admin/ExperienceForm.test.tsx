import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceForm } from './ExperienceForm';

var adminSkillsData = [
  {
    id: 10,
    name: 'Docker',
    slug: 'docker',
    category: 'infra',
    expertiseLevel: 2,
    isHighlighted: false,
    iconKey: 'si:SiDocker',
  },
];

const pushMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
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

// CreateTagDialogForm is no longer used in ExperienceForm; mock kept minimal for safety
vi.mock('./CreateTagDialogForm', () => ({
  CreateTagDialogForm: () => null,
}));

vi.mock('@/hooks/admin/use-admin-skills', () => ({
  useAdminSkills: () => ({
    data: adminSkillsData,
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
    adminSkillsData = [
      {
        id: 10,
        name: 'Docker',
        slug: 'docker',
        category: 'infra',
        expertiseLevel: 2,
        isHighlighted: false,
        iconKey: 'si:SiDocker',
      },
    ];
  });

  afterEach(() => {
    cleanup();
  });

  it('opens create-skill dialog when Criar skill button is clicked', () => {
    render(<ExperienceForm mode="create" />);

    expect(screen.queryByTestId('create-skill-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Criar skill/i));

    expect(screen.getByTestId('create-skill-dialog')).toBeInTheDocument();
  });

  it('renders skills as native checkboxes and toggles selection', () => {
    render(<ExperienceForm mode="create" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Docker' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('keeps create skill action visible when registry is empty', () => {
    adminSkillsData = [];

    render(<ExperienceForm mode="create" />);

    fireEvent.click(screen.getByRole('button', { name: /Criar skill/i }));
    expect(screen.getByTestId('create-skill-dialog')).toBeInTheDocument();
  });

  it('updates slug from role and company while auto slug is enabled', () => {
    render(<ExperienceForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Cargo/i), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: 'Acme' } });

    expect(screen.getByLabelText('Slug')).toHaveValue('backend-engineer-acme');
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
    };

    render(<ExperienceForm mode="edit" experience={experience} />);

    expect(screen.getByLabelText('Fato de impacto 1')).toHaveValue(
      'Liderou migração para microserviços'
    );
    expect(screen.getByLabelText('Fato de impacto 2')).toHaveValue('Reduziu latência em 35%');
  });
});
