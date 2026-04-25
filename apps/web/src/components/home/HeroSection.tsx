'use client';

import { SiTelegram, SiWhatsapp } from '@icons-pack/react-simple-icons';
import type { Skill, SkillCategory } from '@portfolio/shared';
import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';
import { Mail, Star } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GitHubIcon, LinkedInIcon } from '@/components/shared/BrandIcons';
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';
import { Button } from '@/components/ui/button';
import { Marquee } from '@/components/ui/marquee';
import { SOCIAL_LINKS } from '@/lib/constants';
import { HeroResumeDownloadButton } from './HeroResumeDownloadButton';
import { HeroTerminal } from './HeroTerminal';

/**
 * Deferred animated grid — loaded after the main hero content is painted.
 * Using ssr:false removes the 30+ motion instances from the critical
 * hydration pass and keeps them out of the SSR output entirely.
 * The glow blobs are static CSS and remain in the SSR output.
 */
const HeroBackground = dynamic(() => import('./HeroBackground').then((m) => m.HeroBackground), {
  ssr: false,
});

const FALLBACK_STACK = ['TypeScript', 'Bun', 'Next.js', 'PostgreSQL', 'Docker'];
const CATEGORY_ORDER: SkillCategory[] = ['language', 'framework', 'tool', 'db', 'cloud', 'infra'];

interface StackBadge {
  name: string;
  isHighlighted: boolean;
}

function pickStackBadges(skills: Skill[], count = 5): StackBadge[] {
  return [...skills]
    .sort(
      (a, b) =>
        Number(b.isHighlighted) - Number(a.isHighlighted) ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    )
    .slice(0, count)
    .map((s) => ({
      name: s.name,
      isHighlighted: s.isHighlighted,
    }));
}

function getBadgeLabel(stackBadge: StackBadge) {
  return stackBadge.isHighlighted ? `${stackBadge.name}, destaque` : stackBadge.name;
}

interface HeroSectionProps {
  skills?: Skill[];
  experienceLabel: string;
}

export function HeroSection({ skills = [], experienceLabel }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const stack: StackBadge[] =
    skills.length > 0
      ? pickStackBadges(skills)
      : FALLBACK_STACK.map((name) => ({ name, isHighlighted: false }));
  const terminalStack = stack.map((t) => (t.isHighlighted ? `${t.name} ★` : t.name));
  return (
    <section className="relative overflow-hidden min-h-[88vh] flex items-center">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        {/* Animated grid — deferred so it doesn't block initial paint */}
        <HeroBackground />
        {/* Static glow blobs — pure CSS, present in SSR output */}
        <div className="absolute top-0 left-1/4 w-150 h-150 rounded-full bg-emerald-500/6 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 rounded-full bg-cyan-500/4 blur-[100px]" />
      </div>

      <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text content — rendered without entrance animation so the LCP
              text is immediately visible in the initial HTML. The terminal on the
              right is decorative and can animate in after hydration. */}
          <div className="flex flex-col gap-6 order-1">
            {/* Availability indicator */}
            <div className="flex items-center gap-2.5 self-start">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-sm text-emerald-400 font-medium">
                {DEVELOPER_PUBLIC_PROFILE.availability}
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <p className="text-sm font-mono text-zinc-400 tracking-wide">
                {DEVELOPER_PUBLIC_PROFILE.hero.greeting}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                <span className="text-zinc-100">{DEVELOPER_PUBLIC_PROFILE.name}</span>
              </h1>
              <p className="text-2xl md:text-3xl font-semibold">
                <AnimatedGradientText
                  colorFrom="#34d399"
                  colorTo="#22d3ee"
                  speed={1.5}
                  className="text-2xl md:text-3xl font-semibold"
                >
                  {DEVELOPER_PUBLIC_PROFILE.role}
                </AnimatedGradientText>
              </p>
              <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-md">
                {DEVELOPER_PUBLIC_PROFILE.hero.focus}
              </p>
            </div>

            {/* Bio — experienceLabel acts as a credibility opener, bio follows as a self-contained statement */}
            <p className="text-zinc-400 leading-relaxed max-w-lg">
              <span className="text-emerald-400 font-medium">
                {experienceLabel} de experiência.
              </span>{' '}
              {DEVELOPER_PUBLIC_PROFILE.bio}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Currículo PDF — most prominent CTA */}
              <HeroResumeDownloadButton />
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-zinc-800/50 border-zinc-700 text-zinc-200 hover:bg-zinc-700/60 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
              >
                <Link href="/projects">Ver Projetos</Link>
              </Button>
              <Link
                href="/blog"
                className="inline-flex h-11 items-center px-2 text-sm font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-200"
              >
                Ler Blog
              </Link>
            </div>

            {/* Tech stack mini badges — Marquee with reduced-motion fallback */}
            {prefersReducedMotion ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {stack.map((stackBadge) => (
                  <span
                    key={stackBadge.name}
                    role="img"
                    aria-label={getBadgeLabel(stackBadge)}
                    title={getBadgeLabel(stackBadge)}
                    className="inline-flex items-center gap-1 text-xs font-mono bg-zinc-900/80 border px-2 py-0.5 rounded"
                    style={
                      stackBadge.isHighlighted
                        ? { borderColor: 'rgb(52 211 153 / 0.4)', color: '#6ee7b7' }
                        : { borderColor: 'rgb(39 39 42)', color: '#a1a1aa' }
                    }
                  >
                    {stackBadge.name}
                    {stackBadge.isHighlighted && (
                      <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <Marquee
                pauseOnHover
                repeat={4}
                className="pt-1 [--duration:20s] [--gap:0.5rem] overflow-hidden max-w-lg"
              >
                {stack.map((stackBadge) => (
                  <span
                    key={stackBadge.name}
                    role="img"
                    aria-label={getBadgeLabel(stackBadge)}
                    title={getBadgeLabel(stackBadge)}
                    className="inline-flex items-center gap-1 text-xs font-mono bg-zinc-900/80 border px-2 py-0.5 rounded mx-1 shrink-0"
                    style={
                      stackBadge.isHighlighted
                        ? { borderColor: 'rgb(52 211 153 / 0.4)', color: '#6ee7b7' }
                        : { borderColor: 'rgb(39 39 42)', color: '#a1a1aa' }
                    }
                  >
                    {stackBadge.name}
                    {stackBadge.isHighlighted && (
                      <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
                    )}
                  </span>
                ))}
              </Marquee>
            )}

            {/* Social links */}
            <div className="flex items-center gap-1 sm:gap-0.5 -ml-2">
              <a
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
              >
                <GitHubIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              </a>
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
              >
                <LinkedInIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              </a>
              <a
                href={SOCIAL_LINKS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
              >
                <SiTelegram className="h-5 w-5 sm:h-4 sm:w-4" />
              </a>
              <a
                href={SOCIAL_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
              >
                <SiWhatsapp className="h-5 w-5 sm:h-4 sm:w-4" />
              </a>
              <a
                href={SOCIAL_LINKS.email}
                aria-label="E-mail"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
              >
                <Mail className="h-5 w-5 sm:h-4 sm:w-4" />
              </a>
            </div>
          </div>

          {/* Right: Terminal — SSR'd so the chrome is present in the initial
              HTML without any loading skeleton. Motion elements render with
              opacity:0 on the server and animate in after hydration via the
              terminal's own TypingAnimation / AnimatedSpan sequence. */}
          <div className="relative order-2 flex justify-center lg:justify-end">
            <HeroTerminal stack={terminalStack} experienceLabel={experienceLabel} />
          </div>
        </div>
      </div>
    </section>
  );
}
