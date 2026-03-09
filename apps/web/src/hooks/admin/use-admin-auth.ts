'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';

interface GithubStartResponse {
  authUrl: string;
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout', {}),
    onSuccess: () => {
      qc.clear();
      router.push('/admin/login');
    },
    onError: () => {
      // Even on error, redirect to login (session may already be invalid)
      qc.clear();
      router.push('/admin/login');
    },
  });
}

export function useStartGithubOAuth() {
  return useMutation({
    mutationFn: () => apiPost<GithubStartResponse>('/auth/github/start', {}),
  });
}
