import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function BlogNotFound() {
  return (
    <div className="container mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-24 flex flex-col items-center justify-center text-center gap-6">
      <p className="font-mono text-xs text-emerald-500 uppercase tracking-widest">404</p>
      <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">Post não encontrado</h1>
      <p className="text-zinc-500 max-w-md">
        O artigo que você está procurando não existe ou foi removido.
      </p>
      <Button
        asChild
        variant="outline"
        className="gap-2 border-zinc-700 text-zinc-300 hover:border-emerald-500/40 hover:text-zinc-100"
      >
        <Link href="/blog">
          <ArrowLeft className="h-4 w-4" />
          Voltar para o blog
        </Link>
      </Button>
    </div>
  );
}
