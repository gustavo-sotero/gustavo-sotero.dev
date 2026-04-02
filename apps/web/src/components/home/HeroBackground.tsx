'use client';

import { useReducedMotion } from 'motion/react';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';

/**
 * HeroBackground — deferred animated grid for the hero section.
 *
 * Loaded via next/dynamic with ssr:false so the 30+ motion instances
 * that back the grid are excluded from the critical hydration pass.
 * The glow blobs remain in HeroSection as static CSS (no JS needed).
 * This component only contributes once the page is interactive.
 */
export function HeroBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatedGridPattern
      numSquares={prefersReducedMotion ? 0 : 30}
      maxOpacity={0.04}
      duration={3}
      repeatDelay={1}
      className="mask-[radial-gradient(600px_circle_at_center,white,transparent)] stroke-emerald-500/20 fill-emerald-500/5"
    />
  );
}
