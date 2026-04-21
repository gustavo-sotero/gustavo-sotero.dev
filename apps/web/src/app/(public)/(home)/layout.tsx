import { PublicShell } from '@/components/layout/PublicShell';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/">{children}</PublicShell>;
}
