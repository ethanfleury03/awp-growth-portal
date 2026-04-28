'use client';

import { GrowthTabsPage } from '@/components/awp/growth-tabs-page';
import { awpGrowthModules } from '@/lib/awp/config';
import { Megaphone } from 'lucide-react';

export default function OutreachPage() {
  return (
    <GrowthTabsPage
      icon={Megaphone}
      href="/outreach"
      eyebrow="Partner Outreach"
      title="Outreach"
      description="Manage outreach campaigns and prospect lists in one focused workspace."
      tabs={[
        { value: 'campaigns', label: 'Campaigns', config: awpGrowthModules.campaigns },
        { value: 'lists', label: 'Lead Lists', config: awpGrowthModules.leadLists },
      ]}
    />
  );
}
