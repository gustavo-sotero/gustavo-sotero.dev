'use client';

import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { safeRevalidate } from './revalidate';

type MutationCtx<TData, TVariables, TContext> = {
  data: TData;
  variables: TVariables;
  context: TContext | undefined;
  queryClient: QueryClient;
};

type MutationErrorCtx<TVariables, TContext> = {
  error: unknown;
  variables: TVariables;
  context: TContext | undefined;
  queryClient: QueryClient;
};

type InvalidateResolver<TData, TVariables, TContext> =
  | QueryKey
  | ((ctx: MutationCtx<TData, TVariables, TContext>) => QueryKey | QueryKey[] | null | undefined);

interface AdminMutationConfig<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidate?: Array<InvalidateResolver<TData, TVariables, TContext>>;
  revalidateTags?: (ctx: MutationCtx<TData, TVariables, TContext>) => string[];
  successToast?: string | ((ctx: MutationCtx<TData, TVariables, TContext>) => string | undefined);
  errorToast?: string | ((ctx: MutationErrorCtx<TVariables, TContext>) => string | undefined);
  onMutate?: (variables: TVariables, queryClient: QueryClient) => Promise<TContext> | TContext;
  onSuccess?: (ctx: MutationCtx<TData, TVariables, TContext>) => Promise<void> | void;
  onError?: (ctx: MutationErrorCtx<TVariables, TContext>) => Promise<void> | void;
  onSettled?: (ctx: {
    data: TData | undefined;
    error: unknown | null;
    variables: TVariables;
    context: TContext | undefined;
    queryClient: QueryClient;
  }) => Promise<void> | void;
}

function toQueryKeys<TData, TVariables, TContext>(
  resolvers: Array<InvalidateResolver<TData, TVariables, TContext>>,
  ctx: MutationCtx<TData, TVariables, TContext>
): QueryKey[] {
  const result: QueryKey[] = [];

  for (const resolver of resolvers) {
    const value = typeof resolver === 'function' ? resolver(ctx) : resolver;
    if (!value) continue;
    if (Array.isArray(value) && Array.isArray(value[0])) {
      result.push(...(value as QueryKey[]));
      continue;
    }
    result.push(value as QueryKey);
  }

  return result;
}

export function useAdminMutation<TData, TVariables = void, TContext = unknown>(
  config: AdminMutationConfig<TData, TVariables, TContext>
) {
  const queryClient = useQueryClient();
  const mutateHandler = config.onMutate;
  const onMutate = mutateHandler
    ? (variables: TVariables) => mutateHandler(variables, queryClient)
    : undefined;

  return useMutation<TData, unknown, TVariables, TContext>({
    mutationFn: config.mutationFn,
    onMutate,
    onSuccess: async (data, variables, context) => {
      const mutationCtx: MutationCtx<TData, TVariables, TContext> = {
        data,
        variables,
        context,
        queryClient,
      };

      const keys = config.invalidate ? toQueryKeys(config.invalidate, mutationCtx) : [];
      if (keys.length > 0) {
        await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      }

      const tags = config.revalidateTags?.(mutationCtx) ?? [];
      if (tags.length > 0) {
        safeRevalidate(tags);
      }

      const successMessage =
        typeof config.successToast === 'function'
          ? config.successToast(mutationCtx)
          : config.successToast;
      if (successMessage) {
        toast.success(successMessage);
      }

      await config.onSuccess?.(mutationCtx);
    },
    onError: async (error, variables, context) => {
      const errorCtx: MutationErrorCtx<TVariables, TContext> = {
        error,
        variables,
        context,
        queryClient,
      };

      const errorMessage =
        typeof config.errorToast === 'function' ? config.errorToast(errorCtx) : config.errorToast;
      if (errorMessage) {
        toast.error(errorMessage);
      }

      await config.onError?.(errorCtx);
    },
    onSettled: (data, error, variables, context) =>
      config.onSettled?.({
        data,
        error,
        variables,
        context,
        queryClient,
      }),
  });
}
