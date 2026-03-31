import { JetBrains_Mono, Sora } from 'next/font/google';

/**
 * Shared font declarations for the web app.
 *
 * Extracted from app/layout.tsx so that global-error.tsx — which renders
 * outside the root layout and must supply its own <html>/<body> shell —
 * can apply identical typography without duplicating the configuration.
 *
 * Both exports are initialised at module scope (not inside a React component),
 * which is the required pattern for next/font.
 */
export const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-jetbrains',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
