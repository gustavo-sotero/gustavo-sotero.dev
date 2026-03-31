import type { ReactNode } from 'react';

interface PublicSpecialPageProps {
  /**
   * Numeric status code displayed as a large gradient heading (e.g. '404', '500').
   * When provided, the icon is hidden. When omitted, the icon slot is shown instead.
   */
  code?: string;
  /**
   * Short kicker text rendered in monospace above the title.
   * Defaults to a comment built from `code` when not provided.
   */
  kicker?: string;
  /**
   * Icon element shown when no `code` is provided (e.g. for error boundaries).
   */
  icon?: ReactNode;
  /** Main heading text. */
  title: string;
  /** Supporting description paragraph. */
  description: string;
  /**
   * CTA slot — pass a Link+Button for navigation or a plain Button for retry.
   * The caller owns the CTA so error boundaries can wire onClick while
   * not-found pages can wire href without forcing a prop union.
   */
  action: ReactNode;
  /**
   * Semantic heading level. Use `2` when the component renders inside a page
   * that already owns an h1 (e.g. inside an error boundary within a layout).
   * Defaults to `1`.
   */
  headingLevel?: 1 | 2;
  /** Visual accent used by the status code glow and icon treatment. */
  tone?: 'emerald' | 'destructive';
  /** Stretch the composition to the full viewport height when rendered standalone. */
  fullViewport?: boolean;
}

/**
 * Shared visual composition for public special-state pages:
 * 404 not-found variants, error boundaries, and the global-error fallback.
 *
 * Encapsulates the terminal motif, optional status code, icon slot,
 * typography, and CTA slot. Does NOT assume a header, footer, or specific
 * background — the caller owns the surrounding shell.
 */
export function PublicSpecialPage({
  code,
  kicker,
  icon,
  title,
  description,
  action,
  headingLevel = 1,
  tone = 'emerald',
  fullViewport = false,
}: PublicSpecialPageProps) {
  const Heading: 'h1' | 'h2' = headingLevel === 2 ? 'h2' : 'h1';
  const isDestructive = tone === 'destructive';

  const terminalComment = kicker
    ? `// Error: ${kicker}`
    : code
      ? `// Error: ${code}`
      : '// Erro inesperado';

  const glowPrimaryClass = isDestructive ? 'bg-red-500/10' : 'bg-emerald-500/10';
  const glowSecondaryClass = isDestructive ? 'bg-orange-500/8' : 'bg-cyan-500/8';
  const codeGradientClass = isDestructive
    ? 'from-red-400/80 to-red-600/20'
    : 'from-emerald-400/80 to-cyan-400/20';
  const iconSurfaceClass = isDestructive
    ? 'bg-destructive/10 border-destructive/20'
    : 'bg-emerald-500/10 border-emerald-500/20';

  return (
    <section
      className={`relative isolate overflow-hidden px-4 ${fullViewport ? 'flex min-h-screen items-center justify-center py-10' : 'flex min-h-[68vh] items-center justify-center py-16'}`}
    >
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_35%)]" />
      <div
        className={`absolute left-1/2 top-16 -z-10 h-56 w-56 -translate-x-[65%] rounded-full blur-[120px] ${glowPrimaryClass}`}
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-10 left-1/2 -z-10 h-44 w-44 translate-x-[10%] rounded-full blur-[110px] ${glowSecondaryClass}`}
        aria-hidden="true"
      />

      <div className="w-full max-w-4xl rounded-[28px] border border-zinc-800/80 bg-zinc-950/72 px-6 py-10 shadow-[0_32px_120px_rgba(0,0,0,0.42)] backdrop-blur md:px-10 md:py-12">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          {/* Terminal prefix — purely decorative, hidden from assistive tech */}
          <div className="font-mono space-y-1 text-left select-none" aria-hidden="true">
            <p className="text-xs text-zinc-600">~/portfolio $</p>
            <p className="text-xs text-zinc-600">
              {'curl '}
              <span className="text-emerald-400/70">https://gustavo-sotero.dev</span>
              {'/...'}
            </p>
            <p className="text-xs text-red-400/60">{terminalComment}</p>
          </div>

          {code && (
            <div
              className={`font-mono text-7xl leading-none font-bold tracking-tighter text-transparent bg-linear-to-b bg-clip-text select-none md:text-8xl ${codeGradientClass}`}
              aria-hidden="true"
            >
              {code}
            </div>
          )}

          {!code && icon && (
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border ${iconSurfaceClass}`}
            >
              {icon}
            </div>
          )}

          <div className="space-y-3">
            <Heading className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
              {title}
            </Heading>
            <p className="text-muted-foreground max-w-lg text-sm leading-relaxed md:text-base">
              {description}
            </p>
          </div>

          {action}
        </div>
      </div>
    </section>
  );
}
