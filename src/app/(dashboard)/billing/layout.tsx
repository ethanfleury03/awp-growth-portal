import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function BillingLayout({ children }: { children: ReactNode }) {
  await requireModulePage('billing');
  return children;
}
