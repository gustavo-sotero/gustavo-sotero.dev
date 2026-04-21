'use client';

import Link from 'next/link';
import { useBrowserPathname } from '@/hooks/use-browser-pathname';
import { NAV_LINKS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function NavLinks() {
  const pathname = useBrowserPathname();

  return (
    <ul className="hidden md:flex items-center gap-1">
      {NAV_LINKS.map((link) => {
        const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                'relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                'after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:rounded-full',
                'after:transition-all after:duration-300',
                isActive
                  ? 'text-emerald-400 after:bg-emerald-500 after:opacity-100'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 after:opacity-0 hover:after:opacity-30 after:bg-zinc-500'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
