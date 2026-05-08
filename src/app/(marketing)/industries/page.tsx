import type { Metadata } from 'next';
import { IndustriesHero } from '../_components/IndustriesHero';
import { IndustriesGrid } from '../_components/IndustriesGrid';
import { CTABanner } from '../_components/CTABanner';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'Use Cases — WNY Automation Portal',
  description:
    'WNY Automation Portal supports cabin builders, referral partners, hospitality expansion, site-prep workflows, and managed client CRM workspaces.',
  alternates: { canonical: '/industries' },
  openGraph: {
    title: 'Use Cases — WNY Automation Portal',
    description:
      'Cabin builder CRM use cases for buyer pipelines, partner outreach, site readiness, estimates, and reporting.',
    url: '/industries',
    type: 'website',
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Use Cases — WNY Automation Portal',
    description:
      'See supported cabin CRM use cases on WNY Automation Portal.',
    images: [absoluteUrl('/twitter-image')],
  },
};

export default function IndustriesPage() {
  return (
    <>
      <IndustriesHero />
      <IndustriesGrid />
      <CTABanner />
    </>
  );
}
