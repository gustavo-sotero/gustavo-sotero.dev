import { PublicShell } from '@/components/layout/PublicShell';

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell activeHref="/projects">{children}</PublicShell>;
}
