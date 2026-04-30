import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  renderToBufferMock,
  getResumeDataMock,
  buildResumeViewModelMock,
  logServerErrorMock,
  resumePdfDocumentMock,
} = vi.hoisted(() => ({
  renderToBufferMock: vi.fn(),
  getResumeDataMock: vi.fn(),
  buildResumeViewModelMock: vi.fn(),
  logServerErrorMock: vi.fn(),
  resumePdfDocumentMock: vi.fn((props) => ({ props })),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: renderToBufferMock,
}));

vi.mock('@/components/resume/ResumePdfDocument', () => ({
  ResumePdfDocument: resumePdfDocumentMock,
}));

vi.mock('@/lib/data/public/resume', () => ({
  getResumeData: getResumeDataMock,
}));

vi.mock('@/lib/resume/mapper', () => ({
  buildResumeViewModel: buildResumeViewModelMock,
}));

vi.mock('@/lib/server-logger', () => ({
  logServerError: logServerErrorMock,
}));

const { GET } = await import('./route');

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

    getResumeDataMock.mockResolvedValue({
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
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="curriculo-gustavo-sotero.pdf"'
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    expect(getResumeDataMock).toHaveBeenCalledTimes(1);
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

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Nao foi possivel gerar o PDF do curriculo.');
    expect(logServerErrorMock).toHaveBeenCalledWith(
      '/curriculo.pdf',
      'Failed to generate resume PDF',
      expect.objectContaining({ error: 'pdf failed' })
    );
  });
});
