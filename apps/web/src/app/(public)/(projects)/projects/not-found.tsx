import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PublicSpecialPage } from '@/components/shared/PublicSpecialPage';
import { Button } from '@/components/ui/button';

export default function ProjectNotFound() {
  return (
    <PublicSpecialPage
      code="404"
      kicker="Project Not Found"
      title="Projeto não encontrado"
      description="O projeto que você está procurando não existe ou foi removido."
      action={
        <Button
          asChild
          variant="outline"
          className="gap-2 border-zinc-700 text-zinc-300 hover:border-emerald-500/40 hover:text-zinc-100"
        >
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para projetos
          </Link>
        </Button>
      }
    />
  );
}
