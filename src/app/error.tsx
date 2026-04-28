'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)] flex items-center justify-center px-4">
      <div className="max-w-xl w-full brand-card p-8 text-center">
        <p className="text-sm font-semibold text-[var(--brand-orange-600)]">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[var(--brand-ink)]">
          We couldn&apos;t load this page.
        </h1>
        <p className="mt-3 text-[var(--brand-slate)]">
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-ghost-dark">
            Back to home
          </Link>
          <a href="mailto:support@plumber.os" className="btn-ghost-dark">
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
