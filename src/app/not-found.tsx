import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)] flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center brand-card p-8">
        <p className="text-sm font-semibold text-[var(--brand-orange-600)]">404</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[var(--brand-ink)]">Page not found</h1>
        <p className="mt-3 text-[var(--brand-slate)]">
          The page you requested does not exist or may have moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Back to home
          </Link>
          <Link href="/features" className="btn-ghost-dark">
            Browse features
          </Link>
          <Link href="/pricing" className="btn-ghost-dark">
            View pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
