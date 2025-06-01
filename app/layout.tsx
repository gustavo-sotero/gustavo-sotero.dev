import { LanguageProvider } from '@/components/language-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { en } from '@/translations/en';
import { ptBR } from '@/translations/pt-BR';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers'; // Import headers
import type React from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Helper function to determine preferred language from Accept-Language header
async function getPreferredLanguage(): Promise<'en' | 'pt-BR'> {
  const acceptLanguageHeader = (await headers()).get('accept-language');
  if (acceptLanguageHeader) {
    // Simple parsing: check if 'pt' is preferred.
    // For more robust parsing, consider a library.
    const preferredLocales = acceptLanguageHeader
      .split(',')
      .map((lang) => lang.split(';')[0].trim().toLowerCase());
    if (preferredLocales.find((lang) => lang.startsWith('pt'))) {
      return 'pt-BR';
    }
  }
  return 'en'; // Default to English
}

export async function generateMetadata(): Promise<{
  title: string;
  description: string;
}> {
  const lang = await getPreferredLanguage();
  const translations = lang === 'pt-BR' ? ptBR : en;

  return {
    title: translations.metadata.title,
    description: translations.metadata.description
  };
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const lang = await getPreferredLanguage();

  return (
    // Set the lang attribute on the HTML tag based on server-side detection
    <html lang={lang} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false} // Allow transitions on theme change
          storageKey="theme-preference"
        >
          {/* LanguageProvider will initialize on client and may update based on localStorage */}
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
