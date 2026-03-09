interface JsonLdScriptProps {
  data: Record<string, unknown>;
}

function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function JsonLdScript({ data }: JsonLdScriptProps) {
  const safeJson = escapeJsonForHtml(JSON.stringify(data));

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD scripts require inline content; payload is deterministically escaped for script context
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
