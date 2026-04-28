import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'Legal — WNY Automation Portal',
  description: 'Legal policies for use of WNY Automation Portal.',
  metadataBase: new URL(getSiteUrl()),
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[var(--brand-ink)]">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[var(--brand-orange-600)] hover:underline">
            ← WNY Automation Portal home
          </Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-800 leading-relaxed">{children}</div>
    </div>
  );
}
