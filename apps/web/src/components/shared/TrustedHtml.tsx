interface TrustedHtmlProps {
  html: string;
  className?: string;
}

/**
 * Renders HTML that is generated and sanitized by the backend markdown pipeline.
 * Use this boundary only for server-provided `renderedContent` fields.
 */
export function TrustedHtml({ html, className }: TrustedHtmlProps) {
  return (
    <div
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted backend boundary for pre-rendered and sanitized markdown HTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
