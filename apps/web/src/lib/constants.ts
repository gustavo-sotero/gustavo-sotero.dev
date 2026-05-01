import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, FileText, Home, Layers, Mail } from 'lucide-react';

export const SITE_BRAND_NAME = DEVELOPER_PUBLIC_PROFILE.name;

export const SITE_METADATA = {
  title: `${SITE_BRAND_NAME} — Especialista TypeScript · Backend`,
  // bioShort is ≤ 155 chars — prevents Google from truncating the key selling point
  description: DEVELOPER_PUBLIC_PROFILE.bioShort,
  author: SITE_BRAND_NAME,
  url: DEVELOPER_PUBLIC_PROFILE.links.website,
} as const;

export interface NavLinkItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly matchStrategy?: 'section-root';
}

export type PublicNavHref = '/' | '/projects' | '/blog' | '/curriculo' | '/contact';

export interface ResolvedNavLinkItem extends NavLinkItem {
  readonly isActive: boolean;
}

/**
 * Shared navigation model consumed by both the desktop NavLinks and the mobile
 * navigation sheet. Icon components are included here so mobile and desktop
 * renderers share a single source of truth for the nav model.
 *
 * Active state is resolved server-side: each public section layout passes an
 * `activeHref` prop matching its root path (e.g. '/blog') to PublicShell,
 * which forwards it into Header → NavLinks / MobileNav. This eliminates the
 * need for any client-side pathname hook in the public chrome.
 */
export const NAV_LINKS: ReadonlyArray<NavLinkItem> = [
  { label: 'Home', href: '/', icon: Home, matchStrategy: 'section-root' },
  { label: 'Projetos', href: '/projects', icon: Layers, matchStrategy: 'section-root' },
  { label: 'Blog', href: '/blog', icon: BookOpen, matchStrategy: 'section-root' },
  { label: 'Currículo', href: '/curriculo', icon: FileText, matchStrategy: 'section-root' },
  { label: 'Contato', href: '/contact', icon: Mail, matchStrategy: 'section-root' },
];

export function isPublicNavLinkActive(link: NavLinkItem, activeHref: PublicNavHref): boolean {
  switch (link.matchStrategy ?? 'section-root') {
    case 'section-root':
      return link.href === activeHref;
  }
}

export function resolvePublicNavLinks(
  activeHref: PublicNavHref
): ReadonlyArray<ResolvedNavLinkItem> {
  return NAV_LINKS.map((link) => ({
    ...link,
    isActive: isPublicNavLinkActive(link, activeHref),
  }));
}

export const SOCIAL_LINKS = {
  github: DEVELOPER_PUBLIC_PROFILE.links.github,
  linkedin: DEVELOPER_PUBLIC_PROFILE.links.linkedin,
  telegram: DEVELOPER_PUBLIC_PROFILE.links.telegram,
  whatsapp: DEVELOPER_PUBLIC_PROFILE.links.whatsapp,
  email: `mailto:${DEVELOPER_PUBLIC_PROFILE.contacts.email}`,
} as const;
