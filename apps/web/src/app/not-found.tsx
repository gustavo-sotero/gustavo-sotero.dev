import Link from 'next/link';
import { PublicSpecialPage } from '@/components/shared/PublicSpecialPage';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PublicSpecialPage
      code="404"
      kicker="404 Not Found"
      title="Página não encontrada"
      description="Esta rota não existe ou foi removida. Verifique o endereço ou volte ao início."
      action={
        <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold">
          <Link href="/">Voltar para o início</Link>
        </Button>
      }
    />
  );
}
