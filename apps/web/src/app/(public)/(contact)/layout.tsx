import { PublicShell } from '@/components/layout/PublicShell';

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/contact">{children}</PublicShell>;
}
