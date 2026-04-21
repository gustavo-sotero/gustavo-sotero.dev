import { PublicShell } from '@/components/layout/PublicShell';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/blog">{children}</PublicShell>;
}
