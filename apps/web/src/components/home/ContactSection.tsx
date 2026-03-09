'use client';

import { FileText, Mail } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Meteors } from '@/components/ui/meteors';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export function ContactSection() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Section header */}
      <div className="space-y-1">
        <p className="text-sm font-mono text-emerald-500 uppercase tracking-widest">contato</p>
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100">Vamos Conversar?</h2>
      </div>

      {/* CTA card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 backdrop-blur-sm relative overflow-hidden">
        {/* Subtle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl"
        />

        {/* Meteor shower effect (skipped when prefers-reduced-motion) */}
        {!prefersReducedMotion && (
          <Meteors
            number={10}
            minDuration={4}
            maxDuration={12}
            angle={215}
            className="text-emerald-500/20"
          />
        )}

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
              <Mail className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-100 text-lg leading-snug">
                Aberto a novas oportunidades
              </p>
              <p className="mt-1 text-sm text-zinc-400 max-w-md">
                Seja para um projeto freelance, uma posição CLT ou simplesmente trocar uma ideia
                sobre tecnologia — me manda uma mensagem.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/curriculo"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 hover:text-zinc-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <FileText className="h-4 w-4" />
              Ver currículo
            </Link>
            <ShimmerButton
              onClick={() => router.push('/contact')}
              background="rgba(5, 150, 105, 1)"
              shimmerColor="#34d399"
              borderRadius="8px"
              className="shrink-0 text-sm font-medium px-5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Entrar em contato
            </ShimmerButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
