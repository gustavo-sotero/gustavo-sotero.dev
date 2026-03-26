'use client';

import { Github, Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStartGithubOAuth } from '@/hooks/admin/use-admin-auth';

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const startOAuth = useStartGithubOAuth();

  async function handleGitHubLogin() {
    setError(null);
    try {
      const res = await startOAuth.mutateAsync();
      if (!res?.data?.authUrl) {
        throw new Error('Falha ao iniciar autenticação');
      }
      window.location.href = res.data.authUrl;
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err) {
        const apiError = err as { error?: { message?: string } };
        setError(apiError.error?.message ?? 'Falha ao iniciar autenticação');
      } else {
        setError(err instanceof Error ? err.message : 'Erro inesperado');
      }
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-75 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-8 shadow-2xl space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">Área Administrativa</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Acesso restrito ao proprietário</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-zinc-800" />

          {/* Auth button */}
          <div className="space-y-3">
            <Button
              className="w-full gap-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 hover:border-zinc-600 transition-all"
              onClick={handleGitHubLogin}
              disabled={startOAuth.isPending}
            >
              {startOAuth.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              {startOAuth.isPending ? 'Redirecionando...' : 'Entrar com GitHub'}
            </Button>

            {error && (
              <p className="text-xs text-red-400 text-center rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer hint */}
          <p className="text-xs text-zinc-700 text-center">
            Apenas usuários autorizados podem acessar
          </p>
        </div>
      </div>
    </div>
  );
}
