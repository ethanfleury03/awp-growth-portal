import type { Metadata } from 'next';
import { Hero } from './_components/Hero';
import { ValueStrip } from './_components/ValueStrip';
import { FAQ } from './_components/FAQ';
import { FAQ_ITEMS } from './_components/faq-data';
import { CTABanner } from './_components/CTABanner';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'WNY Automation Portal — The operating system for modern plumbing companies',
  description:
    'Capture every call, dispatch the right tech, send estimates, collect payment, and keep customers coming back.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'WNY Automation Portal — The operating system for modern plumbing companies',
    description:
      'Capture every call, dispatch the right tech, send estimates, collect payment, and keep customers coming back.',
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
      'Capture every call, dispatch the right tech, send estimates, collect payment, and keep customers coming back.',
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
