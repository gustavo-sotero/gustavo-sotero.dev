/**
 * Shared font declarations for the web app.
 *
 * Extracted from app/layout.tsx so that global-error.tsx — which renders
 * outside the root layout and must supply its own <html>/<body> shell —
 * can apply identical typography without duplicating the configuration.
 *
 * These are local-first CSS variable tokens instead of `next/font/google` so
 * production builds remain resilient when external font downloads are
 * unavailable. If Sora or JetBrains Mono are installed locally they are used;
 * otherwise the declared fallback stacks take over.
 */
export const sora = {
  variable: 'font-sora-variable',
  className: 'font-sora-local',
} as const;

export const jetbrainsMono = {
  variable: 'font-mono-jetbrains-variable',
  className: 'font-mono-jetbrains-local',
} as const;
