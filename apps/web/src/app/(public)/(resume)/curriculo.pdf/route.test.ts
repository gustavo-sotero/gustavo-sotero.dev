import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  renderToBufferMock,
  getResumeDataUncachedMock,
  buildResumeViewModelMock,
  logServerErrorMock,
  resumePdfDocumentMock,
  unstableRethrowMock,
} = vi.hoisted(() => ({
  renderToBufferMock: vi.fn(),
  getResumeDataUncachedMock: vi.fn(),
  buildResumeViewModelMock: vi.fn(),
  logServerErrorMock: vi.fn(),
  resumePdfDocumentMock: vi.fn((props) => ({ props })),
  unstableRethrowMock: vi.fn(),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: renderToBufferMock,
}));

vi.mock('@/components/resume/ResumePdfDocument', () => ({
  ResumePdfDocument: resumePdfDocumentMock,
}));

vi.mock('@/lib/data/public/resume', () => ({
  getResumeDataUncached: getResumeDataUncachedMock,
}));

vi.mock('@/lib/resume/mapper', () => ({
  buildResumeViewModel: buildResumeViewModelMock,
}));

vi.mock('@/lib/server-logger', () => ({
  logServerError: logServerErrorMock,
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: unstableRethrowMock,
}));

const { GET } = await import('./route');

function buildRequest(headers?: HeadersInit) {
  return new Request('https://gustavo-sotero.dev/curriculo.pdf', { headers });
}

const FIXED_NOW = new Date('2026-04-24T12:34:56.000Z');

class FixedDate extends Date {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
      return;
    }

    super(args[0] as string | number | Date);
  }

  static override now() {
    return FIXED_NOW.getTime();
  }
}

describe('GET /curriculo.pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Date', FixedDate as unknown as DateConstructor);

    getResumeDataUncachedMock.mockResolvedValue({
      state: 'ok',
      data: {
        experience: [],
        education: [],
        skills: [],
        projects: [],
      },
    });
    buildResumeViewModelMock.mockReturnValue({ id: 'resume-vm' });
    renderToBufferMock.mockResolvedValue(Buffer.from('pdf-binary'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a downloadable PDF response generated from the server-side resume data', async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="curriculo-gustavo-sotero.pdf"'
    );
    expect(response.headers.get('Cache-Control')).toBe('public, no-cache, must-revalidate');
    expect(response.headers.get('ETag')).toMatch(/^"resume-pdf-/);

    expect(getResumeDataUncachedMock).toHaveBeenCalledTimes(1);
    expect(buildResumeViewModelMock).toHaveBeenCalledWith({
      experience: [],
      education: [],
      skills: [],
      projects: [],
      now: expect.any(Date),
    });
    expect(resumePdfDocumentMock).toHaveBeenCalledWith({
      resume: { id: 'resume-vm' },
      generatedAt: '24 de abril de 2026',
    });

    expect(Buffer.from(await response.arrayBuffer()).toString('utf8')).toBe('pdf-binary');
  });

  it('logs and returns a 500 response when PDF generation fails', async () => {
    renderToBufferMock.mockRejectedValue(new Error('pdf failed'));

    const response = await GET(buildRequest());

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Nao foi possivel gerar o PDF do curriculo.');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(unstableRethrowMock).toHaveBeenCalledWith(expect.any(Error));
    expect(logServerErrorMock).toHaveBeenCalledWith(
      '/curriculo.pdf',
      'Failed to generate resume PDF',
      expect.objectContaining({ error: 'pdf failed' })
    );
  });

  it('returns 304 and skips PDF rendering when the request ETag still matches', async () => {
    const firstResponse = await GET(buildRequest());
    const etag = firstResponse.headers.get('ETag');

    expect(etag).toBeTruthy();

    if (!etag) {
      throw new Error('Expected the first PDF response to include an ETag.');
    }

    renderToBufferMock.mockClear();

    const response = await GET(
      buildRequest({
        'If-None-Match': etag,
      })
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('Cache-Control')).toBe('public, no-cache, must-revalidate');
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="curriculo-gustavo-sotero.pdf"'
    );
    expect(response.headers.get('ETag')).toBe(etag);
    expect(renderToBufferMock).not.toHaveBeenCalled();
  });
});
