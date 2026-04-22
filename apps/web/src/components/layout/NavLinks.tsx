import Link from 'next/link';
import { type PublicNavHref, resolvePublicNavLinks } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface NavLinksProps {
  activeHref: PublicNavHref;
}

/**
 * Desktop navigation links.
 *
 * Now a Server Component — active state is resolved from the `activeHref` prop
 * provided by the enclosing section layout rather than from a client-side
 * pathname hook. No Suspense boundary is required and the active link is
 * correct in the initial HTML.
 */
export function NavLinks({ activeHref }: NavLinksProps) {
  return (
    <ul className="hidden md:flex items-center gap-1">
      {resolvePublicNavLinks(activeHref).map((link) => {
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                'relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                'after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:rounded-full',
                'after:transition-all after:duration-300',
                link.isActive
                  ? 'text-emerald-400 after:bg-emerald-500 after:opacity-100'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 after:opacity-0 hover:after:opacity-30 after:bg-zinc-500'
              )}
              aria-current={link.isActive ? 'page' : undefined}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
