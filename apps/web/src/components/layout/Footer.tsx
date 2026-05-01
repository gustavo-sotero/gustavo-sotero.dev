import { SiGithub, SiTelegram, SiWhatsapp } from '@icons-pack/react-simple-icons';
import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import { FileCode, Mail, Rss } from 'lucide-react';
import Link from 'next/link';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { getCachedCurrentYear } from '@/lib/cache/time';
import { SITE_BRAND_NAME, SOCIAL_LINKS } from '@/lib/constants';
import { env } from '@/lib/env';

/** Minimal LinkedIn SVG since the brand icon may not be available in all SI versions */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const socialItems = [
  {
    href: SOCIAL_LINKS.github,
    label: 'GitHub',
    icon: <SiGithub className="h-4 w-4" />,
  },
  {
    href: SOCIAL_LINKS.linkedin,
    label: 'LinkedIn',
    icon: <LinkedInIcon className="h-4 w-4" />,
  },
  {
    href: SOCIAL_LINKS.telegram,
    label: 'Telegram',
    icon: <SiTelegram className="h-4 w-4" />,
  },
  {
    href: SOCIAL_LINKS.whatsapp,
    label: 'WhatsApp',
    icon: <SiWhatsapp className="h-4 w-4" />,
  },
  {
    href: SOCIAL_LINKS.email,
    label: 'E-mail',
    icon: <Mail className="h-4 w-4" />,
  },
] as const;

export async function Footer() {
  const CURRENT_YEAR = await getCachedCurrentYear();
  return (
    <footer className="border-t border-zinc-800/60 bg-zinc-950/80">
      <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Logo + description */}
          <div className="flex flex-col items-center gap-1 md:items-start">
            <AnimatedShinyText
              shimmerWidth={90}
              className="font-sans font-bold text-emerald-400 text-lg"
            >
              {SITE_BRAND_NAME}
            </AnimatedShinyText>
            <span className="text-xs text-zinc-400">{DEVELOPER_PUBLIC_PROFILE.role}</span>
          </div>

          {/* Social links */}
          <nav aria-label="Links sociais" className="flex items-center gap-1">
            {socialItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith('mailto') ? undefined : '_blank'}
                rel={item.href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                aria-label={item.label}
                title={item.label}
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {item.icon}
              </a>
            ))}
            <div className="w-px h-5 bg-zinc-800 mx-1" aria-hidden="true" />
            <a
              href={`${env.NEXT_PUBLIC_API_URL}/feed.xml`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="RSS Feed"
              title="RSS Feed"
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Rss className="h-4 w-4" />
            </a>
            <Link
              href={`${env.NEXT_PUBLIC_API_URL}/doc`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Documentação da API"
              title="API Docs"
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <FileCode className="h-4 w-4" />
            </Link>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-zinc-800/40">
          <p className="text-center text-xs text-zinc-400 font-mono">
            © {CURRENT_YEAR} {SITE_BRAND_NAME}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
