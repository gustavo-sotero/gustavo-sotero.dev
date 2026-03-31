import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PublicSpecialPage } from '@/components/shared/PublicSpecialPage';
import { Button } from '@/components/ui/button';

export default function BlogNotFound() {
  return (
    <PublicSpecialPage
      code="404"
      kicker="Post Not Found"
      title="Post não encontrado"
      description="O artigo que você está procurando não existe ou foi removido."
      action={
        <Button
          asChild
          variant="outline"
          className="gap-2 border-zinc-700 text-zinc-300 hover:border-emerald-500/40 hover:text-zinc-100"
        >
          <Link href="/blog">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para o blog
          </Link>
        </Button>
      }
    />
  );
}
