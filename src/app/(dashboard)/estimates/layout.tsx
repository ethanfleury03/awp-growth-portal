import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function EstimatesLayout({ children }: { children: ReactNode }) {
  await requireModulePage('estimates');
  return children;
}
