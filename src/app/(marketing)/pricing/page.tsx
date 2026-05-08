import type { Metadata } from 'next';
import { Pricing } from '../_components/Pricing';
import { CTABanner } from '../_components/CTABanner';
import { absoluteUrl, getSiteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'Pricing — WNY Automation Portal',
  description:
    'Starter, Pro, and Scale plans for CRM workspaces. Feature comparison, monthly or annual billing, no payment markup.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — WNY Automation Portal',
    description:
      'Starter, Pro, and Scale plans for CRM workspaces with feature comparison.',
    url: '/pricing',
    type: 'website',
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — WNY Automation Portal',
    description:
      'Starter, Pro, and Scale plans for polished CRM workspaces.',
    images: [absoluteUrl('/twitter-image')],
  },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const sp = await searchParams;
  const showCanceled = sp.canceled === '1' || sp.canceled === 'true';
  const appLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'WNY Automation Portal',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${getSiteUrl()}/pricing`,
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '149',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '349',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Scale',
        price: '0',
        priceCurrency: 'USD',
        description: 'Custom pricing via sales',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }}
      />
      {showCanceled ? (
        <section className="bg-[var(--brand-cream)] pt-8 pb-2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="brand-card border border-[var(--brand-orange-100)] bg-[var(--brand-orange-50)] p-4 text-sm text-[var(--brand-ink)]">
              Checkout was canceled. Your account was not charged.
            </div>
          </div>
        </section>
      ) : null}
      <Pricing />
      <CTABanner />
    </>
  );
}
