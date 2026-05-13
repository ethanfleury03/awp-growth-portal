'use client';

import Link from 'next/link';
import { Bot, Columns3 } from 'lucide-react';
import { opsButtonClass } from '@/components/ops/ui';
import { cn } from '@/lib/ops';

export function CrmWorkspaceTabs({ active }: { active: 'pipeline' | 'marketing-agent' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/crm"
        className={cn(opsButtonClass(active === 'pipeline' ? 'primary' : 'secondary', 'sm'), 'shrink-0')}
      >
        <Columns3 className="h-4 w-4" />
        Pipeline
      </Link>
      <Link
        href="/crm/marketing-agent"
        className={cn(opsButtonClass(active === 'marketing-agent' ? 'primary' : 'secondary', 'sm'), 'shrink-0')}
      >
        <Bot className="h-4 w-4" />
        Marketing Agent
      </Link>
    </div>
  );
}
