// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearResumePdfDownloadCache } from '@/hooks/useResumePdfDownload';

vi.mock('lucide-react', () => ({
  Download: () => <span data-testid="icon-download" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

import { ResumeDownloadButton } from './ResumeDownloadButton';

const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Response>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('ResumeDownloadButton', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearResumePdfDownloadCache();
    fetchMock = vi.fn();

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:resume-pdf'),
      configurable: true,
      writable: true,
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    clearResumePdfDownloadCache();

    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }

    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: originalCreateObjectURL,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }

    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: originalRevokeObjectURL,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }

    vi.restoreAllMocks();
  });

  it('shows the generating state on the first uncached request and returns to idle afterwards', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorClickMock = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement('a');
        anchor.click = anchorClickMock;
        return anchor;
      }

      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    const response = createDeferredResponse();
    fetchMock.mockReturnValue(response.promise);

    render(<ResumeDownloadButton />);

    fireEvent.click(screen.getByRole('link', { name: 'Baixar currículo em PDF' }));

    expect(fetchMock).toHaveBeenCalledWith('/curriculo.pdf');
    expect(screen.getByText('Gerando PDF...')).toBeInTheDocument();

    response.resolve(new Response('resume-pdf', { status: 200 }));

    await waitFor(() => {
      expect(anchorClickMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Baixar currículo em PDF' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Baixar currículo em PDF' }));

    await waitFor(() => {
      expect(anchorClickMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
  });

  it('returns the button to idle if the PDF request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network-failed'));

    render(<ResumeDownloadButton />);

    fireEvent.click(screen.getByRole('link', { name: 'Baixar currículo em PDF' }));

    expect(screen.getByText('Gerando PDF...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Baixar currículo em PDF' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Gerando PDF...')).not.toBeInTheDocument();
  });
});
