import { PublicShell } from '@/components/layout/PublicShell';

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/curriculo">{children}</PublicShell>;
}
