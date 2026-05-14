'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ClipboardList, Server, Settings, Users } from 'lucide-react';
import { TicketsTab } from './_components/tickets-tab';
import { UserManagementTab } from './_components/user-management-tab';

type AdminSection = 'tickets' | 'users';

const sections = [
  {
    key: 'tickets',
    label: 'Tickets',
    description: 'Client work queue',
    icon: ClipboardList,
  },
  {
    key: 'users',
    label: 'User management',
    description: 'Tenants and access',
    icon: Users,
  },
] as const;

export default function SuperAdminHome() {
  const [section, setSection] = useState<AdminSection>('tickets');

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ops-bg)] lg:flex-row">
      <aside className="shrink-0 border-b border-[var(--ops-border-strong)] bg-[var(--ops-shell-gradient)] text-white lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ops-brand)]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Super Admin</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">WNY operations</p>
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-col lg:overflow-visible">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={`flex min-w-[13rem] items-center gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition lg:min-w-0 ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block font-medium leading-none">{item.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Operations</p>
            <div className="mt-3 space-y-1">
              <Link
                href="/super-admin/staging"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/6 hover:text-white"
              >
                <Server className="h-4 w-4" /> Staging
              </Link>
              <Link
                href="/super-admin/webhook-failures"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/6 hover:text-white"
              >
                <AlertCircle className="h-4 w-4" /> Webhook failures
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {section === 'tickets' ? <TicketsTab /> : <UserManagementTab />}
      </main>
    </div>
  );
}
