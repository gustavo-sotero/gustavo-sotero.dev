import { SiTelegram, SiWhatsapp } from '@icons-pack/react-simple-icons';
import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Laptop,
  Mail,
  MapPin,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GitHubIcon, LinkedInIcon } from '@/components/shared/BrandIcons';
import { SITE_BRAND_NAME, SITE_METADATA, SOCIAL_LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Para Recrutadores',
  description: `${DEVELOPER_PUBLIC_PROFILE.name} — Desenvolvedor Full Stack TypeScript disponível para CLT ou PJ, remoto no Brasil. Confira perfil, diferenciais e formas de contato.`,
  openGraph: {
    title: `Para Recrutadores — ${SITE_BRAND_NAME}`,
    description: `${DEVELOPER_PUBLIC_PROFILE.name} — Full Stack TypeScript, disponível CLT/PJ, remoto. APIs, testes, CI/CD e deploy containerizado.`,
    url: `${SITE_METADATA.url}/recrutadores`,
  },
};

const ctaChannels = [
  {
    label: 'LinkedIn',
    href: SOCIAL_LINKS.linkedin,
    icon: LinkedInIcon,
    description: 'Perfil profissional completo',
  },
  {
    label: 'GitHub',
    href: SOCIAL_LINKS.github,
    icon: GitHubIcon,
    description: 'Código e projetos públicos',
  },
  {
    label: 'Telegram',
    href: SOCIAL_LINKS.telegram,
    icon: SiTelegram,
    description: 'Resposta rápida',
  },
  {
    label: 'WhatsApp',
    href: SOCIAL_LINKS.whatsapp,
    icon: SiWhatsapp,
    description: 'Contato comercial',
  },
];

const highlights = [
  'TypeScript ponta a ponta — frontend (Next.js) e backend (Bun/Node)',
  'APIs REST documentadas com OpenAPI, validação e autenticação robusta',
  'Processamento assíncrono com filas (BullMQ/Redis) e padrão outbox',
  'Testes automatizados (Vitest) e pipeline de CI/CD com GitHub Actions',
  'Deploy containerizado com Docker e observabilidade com logs estruturados',
  'Projeto autoral completo em produção — backend, frontend e infraestrutura',
];

const availabilityDetails = [
  {
    icon: Briefcase,
    title: 'Regime',
    value: 'CLT ou PJ',
    note: 'Contratação formal ou como pessoa jurídica',
  },
  {
    icon: Laptop,
    title: 'Modalidade',
    value: '100% Remoto',
    note: 'Disponível para qualquer empresa no Brasil',
  },
  {
    icon: MapPin,
    title: 'Localização',
    value: `${DEVELOPER_PUBLIC_PROFILE.city}, ${DEVELOPER_PUBLIC_PROFILE.state}`,
    note: 'Fuso UTC-3, horário de Brasília',
  },
  {
    icon: Clock,
    title: 'Disponibilidade',
    value: 'Imediata',
    note: 'Pronto para iniciar novas oportunidades',
  },
];

export default function RecrutadoresPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Header */}
      <div className="mb-12 space-y-4 max-w-2xl">
        <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">
          para recrutadores
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight">
          Desenvolvedor Full Stack TypeScript
          <br />
          <span className="text-emerald-400">disponível para contratação</span>
        </h1>
        <p className="text-zinc-400 leading-relaxed text-lg">
          {DEVELOPER_PUBLIC_PROFILE.objective}
        </p>

        {/* Availability status pill */}
        <div className="flex items-center gap-2.5 pt-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 font-mono text-sm font-medium">
            {DEVELOPER_PUBLIC_PROFILE.availability}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-10">
          {/* Availability block */}
          <section aria-label="Disponibilidade e regime de contratação">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
              Disponibilidade
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availabilityDetails.map(({ icon: Icon, title, value, note }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                      {title}
                    </p>
                    <p className="text-sm font-semibold text-zinc-200 mt-0.5">{value}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Technical highlights */}
          <section aria-label="Diferenciais técnicos">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
              Diferenciais técnicos
            </h2>
            <ul className="space-y-2.5">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span className="text-sm text-zinc-400 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Primary CTAs */}
          <section aria-label="Próximos passos" className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
              Próximos passos
            </h2>

            <Link
              href="/curriculo"
              className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 px-4 py-3 transition-all duration-200"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:border-emerald-500/50 transition-colors">
                <FileText className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  Ver currículo completo
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Versão web interativa e PDF para download
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors shrink-0">
                Abrir →
              </span>
            </Link>

            <Link
              href="/contact"
              className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 px-4 py-3 transition-all duration-200"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:border-emerald-500/50 transition-colors">
                <Mail className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  Entrar em contato
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Formulário de contato ou canais diretos
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors shrink-0">
                Contato →
              </span>
            </Link>

            <Link
              href="/projects"
              className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60 px-4 py-3 transition-all duration-200"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 group-hover:bg-zinc-700/60 transition-colors">
                <Building2 className="h-4 w-4 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  Ver projetos
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Projetos com detalhes de stack e decisões técnicas
                </p>
              </div>
              <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0">
                Ver →
              </span>
            </Link>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-2 space-y-6" aria-label="Canais de contato direto">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
              Canais diretos
            </h2>
            <ul className="space-y-3">
              {ctaChannels.map(({ label, href, icon: Icon, description }) => (
                <li key={label}>
                  <Link
                    href={href}
                    target="_blank"
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
                        {label}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact email callout */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">E-mail</p>
            <a
              href={SOCIAL_LINKS.email}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors break-all"
            >
              {DEVELOPER_PUBLIC_PROFILE.contacts.email}
            </a>
            <p className="text-xs text-zinc-600">Resposta em até 24h</p>
          </div>

          {/* Location note */}
          <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              {DEVELOPER_PUBLIC_PROFILE.city}, {DEVELOPER_PUBLIC_PROFILE.state} · remoto Brasil
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
