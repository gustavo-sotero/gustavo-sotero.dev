/**
 * Shared font declarations for the web app.
 *
 * Extracted from app/layout.tsx so that global-error.tsx — which renders
 * outside the root layout and must supply its own <html>/<body> shell —
 * can apply identical typography without duplicating the configuration.
 *
 * Both fonts are loaded via next/font/google, which downloads and self-hosts
 * them at build time. No CDN requests occur at runtime.
 * The `variable` property is applied to <body> so globals.css can pick up
 * `--font-sora` and `--font-mono-jetbrains` through Tailwind's @theme inline.
 */
import { JetBrains_Mono, Sora } from 'next/font/google';

export const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jetbrains',
  display: 'swap',
});
