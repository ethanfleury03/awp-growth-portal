'use client';

import { LeadPipelineBoard } from '@/components/awp/lead-pipeline-board';
import { BriefcaseBusiness } from 'lucide-react';

export default function CrmPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5 xl:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
          <header className="rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] px-4 py-3 shadow-[var(--ops-shadow-soft)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(47,111,83,0.22)] bg-[rgba(47,111,83,0.08)] text-[var(--ops-brand)]">
                <BriefcaseBusiness className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--ops-muted)]">Cabin Buyer CRM</p>
                <h1 className="text-[1.55rem] font-semibold text-[var(--ops-text)]">Cabin Buyer CRM</h1>
                <p className="text-sm text-[var(--ops-muted)]">
                  Manage cabin opportunities in one configurable pipeline.
                </p>
              </div>
            </div>
          </header>
          <LeadPipelineBoard />
        </div>
      </main>
    </div>
  );
}
