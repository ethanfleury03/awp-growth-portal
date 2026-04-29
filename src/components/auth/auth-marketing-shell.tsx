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
        background: 'linear-gradient(135deg, #f6f8fb 0%, #eef3f8 52%, #fff4ec 100%)',
      }}
    >
      <div className="relative w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, #f26a1f 0%, #d95614 100%)',
              boxShadow: '0 0 40px rgba(242,106,31,0.35)',
            }}
          >
            <Wrench className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1
            className="text-3xl font-bold text-center"
            style={{
              background: 'linear-gradient(90deg, #101828 0%, #d95614 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            WNY Automation Portal
          </h1>
          <p className="text-slate-600 text-sm mt-1 text-center">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
