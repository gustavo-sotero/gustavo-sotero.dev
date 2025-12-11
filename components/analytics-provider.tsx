'use client';

import { useErrorTracking } from '@/hooks/use-error-tracking';
import {
  useUserInteractionTracking,
  useWebVitals
} from '@/hooks/use-observability';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export function AnalyticsProvider({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Inicializa hooks de observabilidade
  useWebVitals();
  useUserInteractionTracking();
  useErrorTracking();

  return (
    <>
      {children}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
