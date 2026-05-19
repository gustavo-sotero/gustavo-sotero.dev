import { describe, expect, it } from 'vitest';
import { normalizeMermaidSource } from './mermaid-source';

describe('normalizeMermaidSource', () => {
  it('removes a BOM and outer blank lines', () => {
    const source = '\uFEFF\n\nsequenceDiagram\n  A->>B: hi\n\n';

    expect(normalizeMermaidSource(source)).toBe('sequenceDiagram\n  A->>B: hi');
  });

  it('normalizes CRLF while preserving inner spacing', () => {
    const source = 'flowchart TD\r\n  A[One]\r\n\r\n  A --> B[Two]\r\n';

    expect(normalizeMermaidSource(source)).toBe('flowchart TD\n  A[One]\n\n  A --> B[Two]');
  });
});
