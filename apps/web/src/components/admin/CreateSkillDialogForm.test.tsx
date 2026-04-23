// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsyncMock = vi.fn();

vi.mock('@/hooks/admin/use-admin-skills', () => ({
  useCreateSkill: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

import { CreateSkillDialogForm } from './CreateSkillDialogForm';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSkillCreated: vi.fn(),
};

describe('CreateSkillDialogForm — name-first flow', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('name input is always enabled and submit stays disabled without category', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    const nameInput = screen.getByLabelText(/Nome/i);

    expect(nameInput).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Criar skill/i })).toBeDisabled();
  });

  it('shows cross-category suggestions when typing', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Post' } });

    const listbox = screen.getByRole('listbox', { name: 'Sugestões' });

    expect(listbox).toBeInTheDocument();

    const names = screen.getAllByRole('option').map((option) => option.textContent ?? '');

    expect(names.some((name) => name.includes('Postman'))).toBe(true);
    expect(names.some((name) => name.includes('PostgreSQL'))).toBe(true);
  });

  it('selecting a mapped suggestion fills the name and auto-detects category', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Type' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /TypeScript/i }));

    expect(screen.getByLabelText(/Nome/i)).toHaveValue('TypeScript');
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('exact alias input also maps category automatically', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'ts' } });

    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria definida automaticamente')).toHaveTextContent(
      'Linguagem'
    );
  });

  it('switching from mapped to unmapped restores editable category select', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'React' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'My Custom Runtime' } });

    expect(screen.queryByText('Definido automaticamente')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/fallback da categoria no backend/i)).toBeInTheDocument();
  });

  it('submit button is disabled when name is set but category is still unknown', () => {
    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'UltraCustomQueue' } });

    expect(screen.getByRole('button', { name: /Criar skill/i })).toBeDisabled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits mapped skill with auto-filled category', async () => {
    const newSkill = {
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      iconKey: 'si:SiTypescript',
      expertiseLevel: 2,
      isHighlighted: false,
      createdAt: '2026-04-23T00:00:00.000Z',
    };
    mutateAsyncMock.mockResolvedValue({ data: newSkill });

    render(<CreateSkillDialogForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'TypeScript' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar skill/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TypeScript',
          category: 'language',
          expertiseLevel: 2,
          isHighlighted: false,
        })
      );
    });
  });

  it('calls onSkillCreated with the created skill after successful submit', async () => {
    const onSkillCreated = vi.fn();
    const newSkill = {
      id: 7,
      name: 'Redis',
      slug: 'redis',
      category: 'db',
      iconKey: 'si:SiRedis',
      expertiseLevel: 2,
      isHighlighted: false,
      createdAt: '2026-04-23T00:00:00.000Z',
    };
    mutateAsyncMock.mockResolvedValue({ data: newSkill });

    render(<CreateSkillDialogForm open={true} onClose={vi.fn()} onSkillCreated={onSkillCreated} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Redis' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Redis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Criar skill/i }));

    await waitFor(() => {
      expect(onSkillCreated).toHaveBeenCalledWith(newSkill);
    });
  });
});
