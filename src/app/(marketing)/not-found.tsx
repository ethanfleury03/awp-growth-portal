import Link from 'next/link';

export default function MarketingNotFound() {
  return (
    <section className="brand-hero-bg min-h-[60vh] flex items-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="brand-card p-8 text-center">
          <p className="text-sm font-semibold text-[var(--brand-orange-600)]">404</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-[var(--brand-ink)]">
            Marketing page not found
          </h1>
          <p className="mt-3 text-[var(--brand-slate)]">
            The page you&apos;re looking for isn&apos;t available right now.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              Go to homepage
            </Link>
            <Link href="/features" className="btn-ghost-dark">
              Features
            </Link>
            <Link href="/pricing" className="btn-ghost-dark">
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
