import Link from 'next/link';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { type PublicNavHref, SITE_BRAND_NAME } from '@/lib/constants';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';

interface HeaderProps {
  activeHref: PublicNavHref;
}

export function Header({ activeHref }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 glass-header">
      <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-sm"
            aria-label={`${SITE_BRAND_NAME} — Voltar ao início`}
          >
            <AnimatedShinyText
              shimmerWidth={90}
              className="font-mono font-bold text-xl text-emerald-400 dark:text-emerald-400"
            >
              {SITE_BRAND_NAME}
            </AnimatedShinyText>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop navigation */}
          <nav aria-label="Navegação principal" className="flex items-center">
            <NavLinks activeHref={activeHref} />
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center">
            <MobileNav activeHref={activeHref} />
          </div>
        </div>
      </div>
    </header>
  );
}
