import type { Metadata } from 'next';
import { LeadForm } from '../_components/LeadForm';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'Contact Sales — WNY Automation Portal',
  description: 'Talk with the WNY Automation Portal team about rollout plans, pricing, and onboarding.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Sales — WNY Automation Portal',
    description: 'Talk with the WNY Automation Portal team about rollout plans and onboarding.',
    url: '/contact',
    type: 'website',
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Sales — WNY Automation Portal',
    description: 'Talk with the WNY Automation Portal team about rollout plans and onboarding.',
    images: [absoluteUrl('/twitter-image')],
  },
};

export default function ContactPage() {
  return (
    <section className="bg-[var(--brand-cream)] py-20 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="eyebrow">Contact sales</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--brand-ink)]">
          Tell us about your workflow.
        </h1>
        <p className="mt-5 text-lg text-[var(--brand-slate)]">
          We&apos;ll map your current workflow and share a practical rollout path for your team.
        </p>

        <div className="mt-10">
          <LeadForm
            kind="contact"
            headline="Request a walkthrough"
            submitLabel="Send request"
            fields={['name', 'email', 'company', 'phone', 'message']}
          />
        </div>
      </div>
    </section>
  );
}
