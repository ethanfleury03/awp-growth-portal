import { MarketingAgentPage } from '@/components/awp/marketing-agent-page';
import { requireModulePage } from '@/lib/modules/access';

export default async function CrmMarketingAgentPage() {
  await requireModulePage('marketing');
  return <MarketingAgentPage />;
}
