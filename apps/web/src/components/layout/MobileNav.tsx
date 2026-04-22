'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { type PublicNavHref, resolvePublicNavLinks } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeHref: PublicNavHref;
}

/**
 * Mobile navigation sheet.
 *
 * Active state is resolved from the `activeHref` prop provided by the
 * enclosing section layout -- no client-side pathname hook needed. The
 * component stays `'use client'` only for the sheet open/close state.
 */
export function MobileNav({ activeHref }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-zinc-950 border-l border-zinc-800/80 w-72 flex flex-col p-0 gap-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>

        {/* Header com botão fechar */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-zinc-800/60">
          <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
            Navegação
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4" aria-label="Navegação mobile">
          <ul className="space-y-0.5">
            {resolvePublicNavLinks(activeHref).map((link) => {
              const Icon = link.icon;

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150',
                      link.isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                    )}
                    aria-current={link.isActive ? 'page' : undefined}
                  >
                    {/* Indicador de ativo */}
                    <span
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full transition-all duration-150',
                        link.isActive ? 'bg-emerald-400 opacity-100' : 'opacity-0'
                      )}
                    />

                    <span
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-md transition-colors duration-150 shrink-0',
                        link.isActive
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-zinc-800/60 text-zinc-500 group-hover:bg-zinc-700/60 group-hover:text-zinc-300'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span>{link.label}</span>

                    {link.isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer minimalista */}
        <div className="px-5 py-4 border-t border-zinc-800/60">
          <p className="text-xs font-mono text-zinc-600">gustavo-sotero.dev</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
