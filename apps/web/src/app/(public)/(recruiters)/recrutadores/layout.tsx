import { PublicShell } from '@/components/layout/PublicShell';

export default function RecrutadoresLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/recrutadores">{children}</PublicShell>;
}
