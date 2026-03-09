import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadState } from '@/hooks/use-admin-uploads';
import { UploadDropzone } from './UploadDropzone';

const uploadMock = vi.fn();
const resetMock = vi.fn();
let currentState: UploadState = { stage: 'idle', progress: 0 };

vi.mock('next/image', () => ({
  default: () => <div data-testid="mock-next-image" />,
}));

vi.mock('@/hooks/use-admin-uploads', () => ({
  useAdminUpload: () => ({
    state: currentState,
    upload: uploadMock,
    reset: resetMock,
  }),
}));

describe('UploadDropzone', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    resetMock.mockReset();
    currentState = { stage: 'idle', progress: 0 };
  });

  it('keeps retry action visible and calls reset on error', () => {
    currentState = {
      stage: 'error',
      progress: 0,
      error: 'Falha no confirm',
    };

    render(<UploadDropzone />);

    expect(screen.getByText('Falha no confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('shows originalUrl as effective fallback when upload is done', () => {
    currentState = {
      stage: 'done',
      progress: 100,
      uploadId: 'upload-1',
      originalUrl: 'https://cdn.example.com/original.jpg',
      optimizedUrl: null,
      variants: null,
    };

    render(<UploadDropzone />);

    expect(screen.getByText('Upload concluído')).toBeInTheDocument();
    expect(screen.getByText('https://cdn.example.com/original.jpg')).toBeInTheDocument();
  });

  it('shows processing stage indicator while optimization is running', () => {
    currentState = {
      stage: 'processing',
      progress: 100,
    };

    render(<UploadDropzone />);

    expect(screen.getByText('Otimizando imagem...')).toBeInTheDocument();
    expect(screen.queryByText('Upload concluído')).not.toBeInTheDocument();
  });

  it('shows optimized URL as effective URL when upload is done with optimizedUrl', () => {
    currentState = {
      stage: 'done',
      progress: 100,
      uploadId: 'upload-1',
      originalUrl: 'https://cdn.example.com/original.jpg',
      optimizedUrl: 'https://cdn.example.com/opt.webp',
      variants: {
        thumbnail: 'https://cdn.example.com/thumb.webp',
        medium: 'https://cdn.example.com/medium.webp',
      },
      effectiveUrl: 'https://cdn.example.com/opt.webp',
    };

    render(<UploadDropzone />);

    expect(screen.getByText('Upload concluído')).toBeInTheDocument();
    expect(screen.getByText('https://cdn.example.com/opt.webp')).toBeInTheDocument();
  });
});
