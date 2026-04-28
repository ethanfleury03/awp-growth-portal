import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'About — WNY Automation Portal',
  description:
    'WNY Automation Portal builds practical software for trade businesses: AI reception, dispatch, estimates, invoices, and payments in one operating system.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — WNY Automation Portal',
    description:
      'The mission and product philosophy behind WNY Automation Portal.',
    url: '/about',
    type: 'website',
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About — WNY Automation Portal',
    description:
      'The mission and product philosophy behind WNY Automation Portal.',
    images: [absoluteUrl('/twitter-image')],
  },
};

export default function AboutPage() {
  return (
    <section className="bg-[var(--brand-cream)] py-20 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="eyebrow">About WNY Automation Portal</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--brand-ink)]">
          Built for service teams that run on trust and speed.
        </h1>
        <p className="mt-6 text-lg text-[var(--brand-slate)] leading-relaxed">
          WNY Automation Portal exists to help trade operators run cleaner handoffs: call to booking, booking to dispatch, and
          job closeout to payment. We focus on practical workflows that reduce admin load and keep crews moving.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="brand-card p-6">
            <h2 className="text-xl font-bold text-[var(--brand-ink)]">Our mission</h2>
            <p className="mt-3 text-[var(--brand-slate)] leading-relaxed">
              Give field-service businesses modern software without forcing them into enterprise complexity. The goal
              is simple: fewer missed calls, fewer manual updates, faster collection.
            </p>
          </article>
          <article className="brand-card p-6">
            <h2 className="text-xl font-bold text-[var(--brand-ink)]">Who we build for</h2>
            <p className="mt-3 text-[var(--brand-slate)] leading-relaxed">
              Independent shops, growing multi-crew teams, and operations leads who need one place to run customer,
              job, estimate, invoice, and payment workflows.
            </p>
          </article>
        </div>

        <div className="mt-10 brand-card p-6">
          <h2 className="text-xl font-bold text-[var(--brand-ink)]">Contact</h2>
          <p className="mt-3 text-[var(--brand-slate)] leading-relaxed">
            Want a product walkthrough or migration plan? Reach out and we&apos;ll help map your rollout.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary">
              Contact sales
            </Link>
            <Link href="/pricing" className="btn-ghost-dark">
              View pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
