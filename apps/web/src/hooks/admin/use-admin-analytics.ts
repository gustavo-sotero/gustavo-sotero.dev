'use client';

import type { AnalyticsSummary, TopPost } from '@portfolio/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { adminKeys } from './query-keys';

interface AnalyticsParams {
  from?: string;
  to?: string;
}

const LIVE_ANALYTICS_REFRESH_INTERVAL_MS = 5_000;

export function useAnalyticsSummary(params: AnalyticsParams = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const query = qs.toString();
  return useQuery<AnalyticsSummary>({
    queryKey: adminKeys.analyticsSummary(params),
    queryFn: () =>
      apiGet<AnalyticsSummary>(`/admin/analytics/summary${query ? `?${query}` : ''}`).then(
        (r) => r?.data as AnalyticsSummary
      ),
    staleTime: 0,
    refetchInterval: LIVE_ANALYTICS_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useAnalyticsTopPosts(params: AnalyticsParams & { limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return useQuery<TopPost[]>({
    queryKey: adminKeys.analyticsTopPosts(params),
    queryFn: () =>
      apiGet<TopPost[]>(`/admin/analytics/top-posts${query ? `?${query}` : ''}`).then(
        (r) => r?.data as TopPost[]
      ),
    staleTime: 0,
    refetchInterval: LIVE_ANALYTICS_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}
