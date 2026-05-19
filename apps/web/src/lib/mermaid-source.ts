export function normalizeMermaidSource(source: string) {
  return source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
}
