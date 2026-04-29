'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { Menu } from 'lucide-react';
import type { CompanyWorkspace } from '@/lib/workspace/types';
import { moduleForPath } from '@/lib/modules/catalog';

type SidebarSlotContextValue = {
  setSidebarAboveUserCard: (node: ReactNode | null) => void;
};

const SidebarSlotContext = createContext<SidebarSlotContextValue | null>(null);

/** Register extra content above the user card in the app sidebar (e.g. Calls AI status). */
export function useSetSidebarAboveUserCard() {
  const ctx = useContext(SidebarSlotContext);
  if (!ctx) {
    throw new Error('useSetSidebarAboveUserCard must be used within DashboardShell');
  }
  return ctx.setSidebarAboveUserCard;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [sidebarAboveUserCard, setSidebarAboveUserCard] = useState<ReactNode>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const setSlot = useCallback((node: ReactNode | null) => {
    setSidebarAboveUserCard(node);
  }, []);

  const value = useMemo(() => ({ setSidebarAboveUserCard: setSlot }), [setSlot]);

  useEffect(() => {
    fetch('/api/company/workspace')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { workspace?: CompanyWorkspace } | null) => {
        const workspace = json?.workspace;
        if (!workspace?.assigned) return;
        const moduleKey = moduleForPath(pathname);
        if (!moduleKey) return;
        if (!workspace.enabledModules.includes(moduleKey)) {
          router.replace(workspace.defaultRoute || '/app');
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return (
    <SidebarSlotContext.Provider value={value}>
      <div className="ops-shell flex h-screen max-h-screen w-full overflow-hidden bg-[var(--ops-bg)] text-[var(--ops-text)]">
        <div className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:self-start">
          <AppSidebar beforeUserCard={sidebarAboveUserCard} />
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-[rgba(8,18,35,0.56)] backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute inset-y-0 left-0">
              <AppSidebar
                mobile
                beforeUserCard={sidebarAboveUserCard}
                onNavigate={() => setMobileNavOpen(false)}
                onClose={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="fixed left-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--ops-border-strong)] bg-white/90 text-[var(--ops-text)] shadow-[var(--ops-shadow-soft)] backdrop-blur lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </button>

        <div className="ops-main flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <CommandPalette />
    </SidebarSlotContext.Provider>
  );
}
