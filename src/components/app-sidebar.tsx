'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Settings,
  ChevronRight,
  Users,
  LogOut,
  BarChart3,
  Bot,
  Megaphone,
  FolderOpen,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Map,
  PhoneCall,
  UserRound,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/types';
import type { CompanyWorkspace } from '@/lib/workspace/types';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/modules/catalog';
import clsx from 'clsx';
import { cn } from '@/lib/ops';
import { roleAtLeast } from '@/lib/auth/types';
import { getGatewayLoginUrl } from '@/lib/auth/gateway-login';

const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  crm: BriefcaseBusiness,
  customers: UserRound,
  tickets: ClipboardList,
  jobs: BriefcaseBusiness,
  estimates: FileText,
  invoices: CreditCard,
  dispatch: Map,
  calendar: CalendarDays,
  receptionist: PhoneCall,
  marketing: FolderOpen,
  outreach: Megaphone,
  'ai-assistant': Bot,
  billing: CreditCard,
  reports: BarChart3,
  assets: FolderOpen,
  settings: Settings,
};

function navItemIsActive(pathname: string, href: string) {
  if (href === '/app') {
    return pathname === '/app';
  }
  if (href === '/crm') {
    return pathname === '/crm' || pathname.startsWith('/crm/') || pathname.startsWith('/leads/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ClerkSignOutIconButton({ className }: { className?: string }) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { accept: 'application/json' },
      });
      const payload = (await response.json().catch(() => null)) as
        | { mode?: string; redirectUrl?: string }
        | null;
      const redirectUrl = payload?.redirectUrl || getGatewayLoginUrl();

      if (payload?.mode === 'gateway-fallback') {
        window.location.assign(redirectUrl);
        return;
      }

      await signOut({ redirectUrl });
    } catch {
      window.location.assign(getGatewayLoginUrl());
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      title={isSigningOut ? 'Signing out' : 'Sign out'}
      className={className}
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}

type AppSidebarProps = {
  /** Rendered above the user profile card for contextual portal status. */
  beforeUserCard?: ReactNode;
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
};

export function AppSidebar({ beforeUserCard, mobile = false, onNavigate, onClose }: AppSidebarProps) {
  const pathname = usePathname() || '';
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspace, setWorkspace] = useState<CompanyWorkspace | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j: { authenticated: boolean; user?: SessionUser; workspace?: CompanyWorkspace }) => {
        if (j.authenticated && j.user) setUser(j.user);
        if (j.authenticated && j.workspace) setWorkspace(j.workspace);
      })
      .catch(() => {});
  }, []);

  const enabledModules = new Set(
    workspace?.enabledModules ?? MODULE_CATALOG.filter((m) => m.defaultEnabled && !m.stagingOnly).map((m) => m.key),
  );
  const navItems = MODULE_CATALOG.filter((module) => {
    if (!enabledModules.has(module.key)) return false;
    return user ? roleAtLeast(user.role, module.requiredRole) : true;
  }).map((module) => ({
    href: module.route,
    label: module.label,
    icon: MODULE_ICONS[module.key],
  }));
  const branding = workspace?.branding;

  const navLinkClass = (active: boolean) =>
    clsx(
      'sidebar-item flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm',
      active ? 'active text-white' : 'text-slate-300 hover:text-white',
    );

  const handleNavigate = () => {
    onNavigate?.();
  };

  return (
    <aside
      className={cn(
        'sidebar flex min-h-0 w-[18rem] flex-col text-white',
        mobile ? 'h-full max-h-full' : 'h-screen max-h-screen shrink-0',
      )}
    >
      <div className="relative z-10 border-b border-white/10 px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-3" onClick={handleNavigate}>
            <div className="sidebar-logo flex h-10 w-10 items-center justify-center rounded-lg">
              <span className="text-sm font-bold">WNY</span>
            </div>
            <div>
              <span className="block text-lg font-semibold text-white">
                {branding?.portalTitle ?? 'WNY Automation Portal'}
              </span>
              <span className="block text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {branding?.displayName ?? 'Client Portal'}
              </span>
            </div>
          </Link>
          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/6 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {branding?.workspaceLabel ?? 'Automation workspace'}
              </p>
            </div>
            <div className="rounded-full bg-emerald-400/16 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
              Live
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            CRM pipeline, automations, workflow status, reporting, and account activity in one shared portal.
          </p>
        </div>
      </div>

      <nav className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mb-3">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Portal</p>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = navItemIsActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              className={navLinkClass(active)}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
              <span className="font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto relative z-10">
        {beforeUserCard ? (
          <div className="border-t border-white/10 px-4 pt-4">{beforeUserCard}</div>
        ) : null}

        <div className="border-t border-white/10 p-4">
          <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ops-brand)] text-sm font-bold">
              {user?.avatarInitials ?? '??'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name || user?.email || '—'}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-400">{user?.role ?? 'owner'}</p>
            </div>
            <ClerkSignOutIconButton className="shrink-0 rounded-xl p-2 text-slate-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100" />
          </div>
        </div>
      </div>
    </aside>
  );
}
