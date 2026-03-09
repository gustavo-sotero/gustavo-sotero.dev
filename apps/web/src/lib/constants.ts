import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';

export const SITE_BRAND_NAME = DEVELOPER_PUBLIC_PROFILE.name;

export const SITE_METADATA = {
  title: `${SITE_BRAND_NAME} — Especialista TypeScript · Backend`,
  // bioShort is ≤ 155 chars — prevents Google from truncating the key selling point
  description: DEVELOPER_PUBLIC_PROFILE.bioShort,
  author: SITE_BRAND_NAME,
  url: DEVELOPER_PUBLIC_PROFILE.links.website,
} as const;

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Projetos', href: '/projects' },
  { label: 'Blog', href: '/blog' },
  { label: 'Currículo', href: '/curriculo' },
  { label: 'Contato', href: '/contact' },
] as const;

export const SOCIAL_LINKS = {
  github: DEVELOPER_PUBLIC_PROFILE.links.github,
  linkedin: DEVELOPER_PUBLIC_PROFILE.links.linkedin,
  telegram: DEVELOPER_PUBLIC_PROFILE.links.telegram,
  whatsapp: DEVELOPER_PUBLIC_PROFILE.links.whatsapp,
  email: `mailto:${DEVELOPER_PUBLIC_PROFILE.contacts.email}`,
} as const;
