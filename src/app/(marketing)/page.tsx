import type { Metadata } from 'next';
import { Hero } from './_components/Hero';
import { ValueStrip } from './_components/ValueStrip';
import { FAQ } from './_components/FAQ';
import { FAQ_ITEMS } from './_components/faq-data';
import { CTABanner } from './_components/CTABanner';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'WNY Automation Portal — CRM for custom cabin builders',
  description:
    'Organize cabin buyers, site-readiness details, estimates, marketing outreach, reporting, and AI-assisted follow-up in one secure workspace.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'WNY Automation Portal — CRM for custom cabin builders',
    description:
      'Organize cabin buyers, site-readiness details, estimates, marketing outreach, reporting, and AI-assisted follow-up in one secure workspace.',
    url: '/',
    type: 'website',
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'WNY Automation Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WNY Automation Portal',
    description:
      'Organize cabin buyers, estimates, outreach, reporting, and AI-assisted follow-up.',
    images: [absoluteUrl('/twitter-image')],
  },
};

export default function LandingPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <Hero />
      <ValueStrip />
      <FAQ />
      <CTABanner />
    </>
  );
}
