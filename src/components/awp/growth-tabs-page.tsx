'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GrowthModulePage } from '@/components/awp/growth-module-page';
import { AppPageHeader, opsButtonClass } from '@/components/ops/ui';
import type { GrowthModuleConfig } from '@/lib/awp/config';
import type { LucideIcon } from 'lucide-react';

type GrowthTab = {
  value: string;
  label: string;
  config: GrowthModuleConfig;
};

export function GrowthTabsPage({
  title,
  eyebrow,
  description,
  href,
  icon: Icon,
  tabs,
}: {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tabs: GrowthTab[];
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') || tabs[0]?.value;
  const activeTab = tabs.find((tab) => tab.value === requestedTab) || tabs[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            icon={Icon}
            eyebrow={eyebrow}
            title={title}
            description={description}
            actions={
              <>
                {tabs.map((tab) => (
                  <Link
                    key={tab.value}
                    href={`${href}?tab=${tab.value}`}
                    className={opsButtonClass(tab.value === activeTab.value ? 'primary' : 'secondary')}
                  >
                    {tab.label}
                  </Link>
                ))}
              </>
            }
          />

          <GrowthModulePage config={activeTab.config} embedded />
        </div>
      </main>
    </div>
  );
}
