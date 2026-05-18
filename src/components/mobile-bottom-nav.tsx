'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Map,
  Megaphone,
  MoreHorizontal,
  PhoneCall,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { SessionUser } from '@/lib/auth/types';
import { roleAtLeast } from '@/lib/auth/types';
import type { CompanyWorkspace } from '@/lib/workspace/types';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/modules/catalog';

const PRIMARY_MODULES: ModuleKey[] = ['dashboard', 'crm', 'customers', 'tickets'];

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
  if (href === '/app') return pathname === '/app';
  if (href === '/crm') return pathname === '/crm' || pathname.startsWith('/crm/') || pathname.startsWith('/leads/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shortLabel(label: string) {
  if (label === 'AI Growth Assistant') return 'AI';
  if (label === 'AI Receptionist') return 'Calls';
  return label;
}

type NavItem = {
  key: ModuleKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

export function MobileBottomNav() {
  const pathname = usePathname() || '';
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspace, setWorkspace] = useState<CompanyWorkspace | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { authenticated: boolean; user?: SessionUser; workspace?: CompanyWorkspace } | null) => {
        if (!mounted || !json) return;
        if (json.authenticated && json.user) setUser(json.user);
        if (json.authenticated && json.workspace) setWorkspace(json.workspace);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const navItems = useMemo<NavItem[]>(() => {
    const enabledModules = new Set(
      workspace?.enabledModules ??
        MODULE_CATALOG.filter((module) => module.defaultEnabled && !module.stagingOnly).map((module) => module.key),
    );

    return MODULE_CATALOG.filter((module) => {
      if (!enabledModules.has(module.key)) return false;
      return user ? roleAtLeast(user.role, module.requiredRole) : true;
    }).map((module) => ({
      key: module.key,
      href: module.route,
      label: module.label,
      icon: MODULE_ICONS[module.key],
    }));
  }, [user, workspace]);

  const primaryItems = PRIMARY_MODULES.map((key) => navItems.find((item) => item.key === key)).filter(
    Boolean,
  ) as NavItem[];
  const primaryKeys = new Set(primaryItems.map((item) => item.key));
  const moreItems = navItems.filter((item) => !primaryKeys.has(item.key));
  const moreActive = moreItems.some((item) => navItemIsActive(pathname, item.href));
  const navColumnCount = primaryItems.length + (moreItems.length ? 1 : 0);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" aria-label="More portal navigation">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(8,18,35,0.38)]"
            aria-label="Close more navigation"
            onClick={() => setMoreOpen(false)}
          />
          <section className="mobile-more-sheet absolute inset-x-3 bottom-0 rounded-t-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-3 shadow-[var(--ops-shadow-soft)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ops-text)]">More</p>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--ops-muted)]"
                aria-label="Close more navigation"
                onClick={() => setMoreOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = navItemIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={clsx(
                      'flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm font-semibold',
                      active
                        ? 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)]'
                        : 'border-[var(--ops-border)] bg-white text-[var(--ops-text)]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{shortLabel(item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ops-border)] bg-[rgba(255,255,250,0.96)] px-2 pt-2 shadow-[0_-12px_32px_-24px_rgba(16,28,50,0.34)] backdrop-blur lg:hidden">
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(navColumnCount, 1)}, minmax(0, 1fr))` }}
        >
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = navItemIsActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold',
                  active ? 'bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)]' : 'text-[var(--ops-muted)]',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate">{shortLabel(item.label)}</span>
              </Link>
            );
          })}
          {moreItems.length ? (
            <button
              type="button"
              className={clsx(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold',
                moreActive || moreOpen ? 'bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)]' : 'text-[var(--ops-muted)]',
              )}
              aria-expanded={moreOpen}
              aria-label="Open more navigation"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              <span>More</span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
