'use client';

import type { ReactNode } from 'react';
import { Wrench } from 'lucide-react';

export function AuthMarketingShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#f3f5f1',
      }}
    >
      <div className="relative w-full max-w-md flex flex-col items-center gap-5">
        <div className="flex flex-col items-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{
              background: '#2f6b4f',
            }}
          >
            <Wrench className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-center text-slate-950">
            WNY Automation Portal
          </h1>
          <p className="text-slate-600 text-sm mt-1 text-center">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
