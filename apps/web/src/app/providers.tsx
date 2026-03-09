'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as Record<string, unknown>).error === 'object' &&
    (error as { error: { code?: string } }).error?.code === 'UNAUTHORIZED'
  );
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    window.location.href = '/admin/login';
  }
}

function handleUnauthorized(queryClient: QueryClient) {
  queryClient.clear();
  redirectToLogin();
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          if (isUnauthorized(error)) handleUnauthorized(client);
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (isUnauthorized(error)) handleUnauthorized(client);
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          retry: (failureCount, error) => {
            // Never retry on 401
            if (isUnauthorized(error)) return false;
            return failureCount < 1;
          },
          refetchOnWindowFocus: false,
        },
      },
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-zinc-900 border border-zinc-800 text-zinc-100',
            description: 'text-zinc-400',
            actionButton: 'bg-emerald-500 text-zinc-950',
            cancelButton: 'bg-zinc-800 text-zinc-400',
            error: 'border-red-500/40',
            success: 'border-emerald-500/40',
          },
        }}
      />
    </QueryClientProvider>
  );
}
