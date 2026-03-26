import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EducationForm } from './EducationForm';

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

vi.mock('@/hooks/admin/use-admin-education', () => ({
  useCreateEducation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useUpdateEducation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('./CoverMediaField', () => ({
  CoverMediaField: () => <div data-testid="cover-media-field" />,
}));

describe('EducationForm', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pushMock.mockReset();
    generateSlugMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('updates slug from title and institution while auto slug is enabled', () => {
    render(<EducationForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Título \/ Curso/i), {
      target: { value: 'Ciência da Computação' },
    });
    fireEvent.change(screen.getByLabelText(/Instituição/i), {
      target: { value: 'Universidade XYZ' },
    });

    expect(screen.getByLabelText('Slug')).toHaveValue('ci-ncia-da-computa-o-universidade-xyz');
    expect(generateSlugMock).toHaveBeenLastCalledWith('Ciência da Computação-Universidade XYZ');
  });

  it('preserves manual slug edits after auto slug is disabled', () => {
    render(<EducationForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Título \/ Curso/i), {
      target: { value: 'ADS' },
    });
    fireEvent.change(screen.getByLabelText(/Instituição/i), {
      target: { value: 'FATEC' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-gerado/i }));
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'slug-manual' },
    });
    fireEvent.change(screen.getByLabelText(/Instituição/i), {
      target: { value: 'USP' },
    });

    expect(screen.getByLabelText('Slug')).toHaveValue('slug-manual');
  });
});
