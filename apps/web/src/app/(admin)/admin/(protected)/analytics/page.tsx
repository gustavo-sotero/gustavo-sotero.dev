'use client';

import { AnalyticsScreenComposition } from '@/components/admin/AnalyticsScreenComposition';

export default function AdminAnalyticsPage() {
  return (
    <AnalyticsScreenComposition
      title="Analytics"
      subtitle="Visão detalhada de acessos e métricas"
      topPostsLimit={10}
    />
  );
}
