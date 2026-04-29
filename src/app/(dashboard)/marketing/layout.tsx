import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  await requireModulePage('marketing');
  return children;
}
