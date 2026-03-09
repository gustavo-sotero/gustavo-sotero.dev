import { SiGithub, SiTelegram, SiWhatsapp } from '@icons-pack/react-simple-icons';
import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';
import { FileText, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { ContactForm } from '@/components/shared/ContactForm';
import { SITE_BRAND_NAME, SOCIAL_LINKS } from '@/lib/constants';

/** Minimal LinkedIn SVG */
function LinkedInIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export const metadata: Metadata = {
  title: 'Contato',
  description: `Entre em contato com ${SITE_BRAND_NAME} — disponível para projetos freelance, oportunidades e colaborações.`,
};

const contactChannels: Array<{
  label: string;
  href: string;
  icon: IconComponent;
  value: string;
  description: string;
}> = [
  {
    label: 'E-mail',
    href: SOCIAL_LINKS.email,
    icon: ({ size, className }) => <Mail size={size} className={className} />,
    value: DEVELOPER_PUBLIC_PROFILE.contacts.email,
    description: 'Resposta em até 24h',
  },
  {
    label: 'Telefone',
    href: `tel:${DEVELOPER_PUBLIC_PROFILE.contacts.phone.replace(/\s+/g, '')}`,
    icon: ({ size, className }) => <Phone size={size} className={className} />,
    value: DEVELOPER_PUBLIC_PROFILE.contacts.phone,
    description: 'Contato por ligação',
  },
  {
    label: 'LinkedIn',
    href: SOCIAL_LINKS.linkedin,
    icon: LinkedInIcon,
    value: DEVELOPER_PUBLIC_PROFILE.links.linkedin,
    description: 'Rede profissional',
  },
  {
    label: 'GitHub',
    href: SOCIAL_LINKS.github,
    icon: ({ size, className }) => <SiGithub size={size} className={className} />,
    value: DEVELOPER_PUBLIC_PROFILE.links.github,
    description: 'Código e projetos',
  },
  {
    label: 'Telegram',
    href: SOCIAL_LINKS.telegram,
    icon: ({ size, className }) => <SiTelegram size={size} className={className} />,
    value: DEVELOPER_PUBLIC_PROFILE.links.telegram,
    description: 'Contato rápido',
  },
  {
    label: 'WhatsApp',
    href: SOCIAL_LINKS.whatsapp,
    icon: ({ size, className }) => <SiWhatsapp size={size} className={className} />,
    value: DEVELOPER_PUBLIC_PROFILE.links.whatsapp,
    description: 'Contato comercial',
  },
];

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 space-y-3 max-w-xl">
        <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">contato</p>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">Vamos conversar?</h1>
        <p className="text-zinc-400 leading-relaxed">
          Disponível para projetos freelance, oportunidades de trabalho e colaborações. Mande uma
          mensagem — respondo em breve.
        </p>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 font-mono text-xs">
            {DEVELOPER_PUBLIC_PROFILE.availability}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Form — takes more space */}
        <div className="lg:col-span-3 space-y-6">
          {/* Resume CTA */}
          <Link
            href="/curriculo"
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 px-4 py-3 transition-all duration-200"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:border-emerald-500/50 transition-colors">
              <FileText className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                Prefere ver o currículo primeiro?
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Acesse a versão web ou baixe o PDF atualizado
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors shrink-0">
              Ver currículo →
            </span>
          </Link>

          <ContactForm />
        </div>

        {/* Sidebar channels */}
        <aside className="lg:col-span-2 space-y-5" aria-label="Outros canais de contato">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
            Outros canais
          </h2>
          <ul className="space-y-3">
            {contactChannels.map((channel) => {
              const Icon = channel.icon;
              return (
                <li key={channel.label}>
                  <Link
                    href={channel.href}
                    target={channel.href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60 transition-colors group"
                  >
                    <div className="mt-0.5 shrink-0 h-7 w-7 rounded-md bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700/60 transition-colors">
                      <Icon
                        size={14}
                        className="text-zinc-400 group-hover:text-zinc-300 transition-colors"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-300 group-hover:text-zinc-200 transition-colors">
                        {channel.label}
                      </p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{channel.description}</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{channel.value}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Location note */}
          <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono mt-4">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{DEVELOPER_PUBLIC_PROFILE.location} · disponível para remoto</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
