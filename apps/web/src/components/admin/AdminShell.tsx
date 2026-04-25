'use client';

import {
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  ChevronRight,
  GraduationCap,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLogout } from '@/hooks/admin/use-admin-auth';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Posts', href: '/admin/posts', icon: BookOpen },
  { label: 'Projetos', href: '/admin/projects', icon: Terminal },
  { label: 'Experiência', href: '/admin/experience', icon: Briefcase },
  { label: 'Formação', href: '/admin/education', icon: GraduationCap },
  { label: 'Tags', href: '/admin/tags', icon: Tag },
  { label: 'Skills', href: '/admin/skills', icon: Zap },
  { label: 'Comentários', href: '/admin/comments', icon: MessageSquare },
  { label: 'Uploads', href: '/admin/uploads', icon: ImageIcon },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Assistente IA', href: '/admin/settings/ai-post-generation', icon: Bot },
];

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      aria-label={item.label}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        'hover:bg-zinc-800/80 hover:text-zinc-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        active
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'text-zinc-400 border border-transparent'
      )}
    >
      <Icon
        className={cn('shrink-0 transition-colors', active ? 'text-emerald-400' : 'text-zinc-500')}
        size={16}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { mutate: logout, isPending: loggingOut } = useLogout();

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
        {/* Sidebar */}
        <aside
          className={cn(
            'relative flex flex-col border-r border-zinc-800/60 bg-zinc-950 transition-all duration-300 ease-in-out shrink-0',
            collapsed ? 'w-15' : 'w-55'
          )}
        >
          {/* Logo / brand */}
          <div
            className={cn(
              'flex items-center border-b border-zinc-800/60 py-4 px-3',
              collapsed ? 'justify-center' : 'gap-3 px-4'
            )}
          >
            {collapsed ? (
              <span className="text-emerald-400 font-mono font-bold text-lg">&gt;_</span>
            ) : (
              <>
                <span className="text-emerald-400 font-mono font-bold text-lg">&gt;_</span>
                <span className="font-semibold text-zinc-100 text-sm truncate">Admin</span>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5"
            aria-label="Admin navigation"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href + item.label}
                item={item}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
            ))}
          </nav>

          <Separator className="bg-zinc-800/60" />

          {/* Bottom: collapse toggle + logout */}
          <div className="py-3 px-2 space-y-0.5">
            {/* Collapse toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCollapsed((v) => !v)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    'text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300 border border-transparent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    collapsed ? 'justify-center' : ''
                  )}
                  aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
                >
                  {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                  {!collapsed && <span>Recolher</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Expandir sidebar
                </TooltipContent>
              )}
            </Tooltip>

            {/* Logout */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => logout()}
                  disabled={loggingOut}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    'text-zinc-500 hover:bg-red-950/30 hover:text-red-400 border border-transparent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
                    collapsed ? 'justify-center' : ''
                  )}
                  aria-label="Sair"
                >
                  <LogOut size={16} />
                  {!collapsed && <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  Sair
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-14 items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-6 backdrop-blur-sm">
            {/* Breadcrumb-style title */}
            <Breadcrumb pathname={pathname} />

            {/* Header actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                target="_blank"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
              >
                ver site ↗
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6" id="admin-content">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.replace('/admin', '').split('/').filter(Boolean);

  const labels: Record<string, string> = {
    posts: 'Posts',
    projects: 'Projetos',
    tags: 'Tags',
    comments: 'Comentários',
    uploads: 'Uploads',
    analytics: 'Analytics',
    experience: 'Experiência',
    education: 'Formação',
    new: 'Novo',
    edit: 'Editar',
  };

  if (segments.length === 0) {
    return (
      <span className="text-sm font-medium text-zinc-100 flex items-center gap-1.5">
        <LayoutDashboard size={14} className="text-emerald-400" />
        Dashboard
      </span>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/admin" className="text-zinc-500 hover:text-zinc-300 transition-colors">
        Admin
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = labels[seg] ?? seg;
        return (
          <span key={seg} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-zinc-700" />
            {isLast ? (
              <span className="text-zinc-100 font-medium">{label}</span>
            ) : (
              <span className="text-zinc-500">{label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
