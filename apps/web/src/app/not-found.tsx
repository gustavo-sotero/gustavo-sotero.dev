import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/* ASCII-style terminal 404 */}
      <div className="font-mono space-y-1 text-left select-none">
        <p className="text-xs text-zinc-600">~/portfolio $</p>
        <p className="text-xs text-zinc-600">
          curl <span className="text-emerald-400">https://gustavo-sotero.dev</span>/???
        </p>
        <p className="text-xs text-red-400/70">{'// Error: 404 Not Found'}</p>
      </div>
      <div className="font-mono text-8xl font-bold tracking-tighter text-transparent bg-linear-to-b from-emerald-400/80 to-emerald-600/20 bg-clip-text leading-none">
        404
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Página não encontrada</h1>
        <p className="text-muted-foreground max-w-sm">
          Esta rota não existe ou foi removida. Verifique o endereço ou volte ao início.
        </p>
      </div>
      <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
