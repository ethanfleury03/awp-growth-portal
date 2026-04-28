'use client';

import { GrowthTabsPage } from '@/components/awp/growth-tabs-page';
import { awpGrowthModules } from '@/lib/awp/config';
import { FolderOpen } from 'lucide-react';

export default function MarketingPage() {
  return (
    <GrowthTabsPage
      icon={FolderOpen}
      href="/marketing"
      eyebrow="Marketing Work"
      title="Marketing"
      description="Organize sales assets, website growth work, and cabin project case studies together."
      tabs={[
        { value: 'assets', label: 'Assets', config: awpGrowthModules.assets },
        { value: 'seo', label: 'Website / SEO', config: awpGrowthModules.seoTasks },
        { value: 'projects', label: 'Projects', config: awpGrowthModules.projects },
      ]}
    />
  );
}
