'use client';

import { AnalyticsScreenComposition } from '@/components/admin/AnalyticsScreenComposition';
import { DlqPanel } from '@/components/admin/DlqPanel';

export default function AdminDashboardPage() {
  return (
    <AnalyticsScreenComposition
      title="Dashboard"
      subtitle="Visão geral do portfólio"
      topPostsLimit={8}
      aside={<DlqPanel />}
    />
  );
}
