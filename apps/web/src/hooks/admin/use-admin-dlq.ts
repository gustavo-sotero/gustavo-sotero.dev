'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { adminKeys } from './query-keys';

/** Per-queue job counts returned by BullMQ. */
export interface DlqQueueCounts {
  wait?: number;
  active?: number;
  failed?: number;
  delayed?: number;
  completed?: number;
}

/** A single DLQ queue entry in the backend response. */
export interface DlqQueue {
  name: string;
  counts: DlqQueueCounts;
  total: number;
}

/** Full response shape for GET /admin/jobs/dlq. */
export interface DlqResponse {
  queues: DlqQueue[];
  totalFailed: number;
}

export function useDlq() {
  return useQuery<DlqResponse>({
    queryKey: adminKeys.dlq(),
    queryFn: () => apiGet<DlqResponse>('/admin/jobs/dlq').then((r) => r?.data as DlqResponse),
    refetchInterval: 30_000,
  });
}
