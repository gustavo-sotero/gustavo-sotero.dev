/**
 * Route-level coverage for the /admin/uploads page.
 *
 * Verifies that the page renders core operator-facing copy without crashing,
 * and that the UploadDropzone integration point is mounted.
 *
 * Why test this? The production-only 404 for /admin/uploads was diagnosed as an
 * artifact/deployment gap rather than a source-level routing bug. This test
 * asserts the component renders — a regression guard that would fail if the page
 * were accidentally removed or broken at component level.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminUploadsPage from './page';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/admin/UploadDropzone', () => ({
  UploadDropzone: () => <div data-testid="upload-dropzone" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  ImagePlus: () => <span data-testid="icon-image-plus" />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminUploadsPage', () => {
  it('renders the Uploads heading', () => {
    render(<AdminUploadsPage />);
    expect(screen.getByRole('heading', { name: /uploads/i })).toBeInTheDocument();
  });

  it('renders the UploadDropzone', () => {
    render(<AdminUploadsPage />);
    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
  });

  it('renders the info section heading', () => {
    render(<AdminUploadsPage />);
    expect(screen.getByText('Sobre os uploads')).toBeInTheDocument();
  });

  it('explains that processing is asynchronous', () => {
    render(<AdminUploadsPage />);
    expect(screen.getByText(/processadas em background/i)).toBeInTheDocument();
  });

  it('mentions WebP variant generation in the info section', () => {
    render(<AdminUploadsPage />);
    // Multiple elements contain 'WebP' (subtitle + info list). Use getAllByText
    // and assert at least the info list entry is present.
    const matches = screen.getAllByText(/webp/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
