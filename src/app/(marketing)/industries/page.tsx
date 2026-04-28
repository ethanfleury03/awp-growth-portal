import type { Metadata } from 'next';
import { IndustriesHero } from '../_components/IndustriesHero';
import { IndustriesGrid } from '../_components/IndustriesGrid';
import { CTABanner } from '../_components/CTABanner';
import { absoluteUrl } from '@/lib/marketing/site';

export const metadata: Metadata = {
  title: 'Industries — WNY Automation Portal',
  description:
    'WNY Automation Portal is built for plumbers today and expanding to every home-services trade. See which industries are live and which are on the roadmap.',
  alternates: { canonical: '/industries' },
  openGraph: {
    title: 'Industries — WNY Automation Portal',
    description:
      'Built for plumbers today and expanding to electrical, HVAC, roofing, and more.',
    url: '/industries',
    type: 'website',
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Industries — WNY Automation Portal',
    description:
      'See supported and upcoming trades on WNY Automation Portal.',
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
