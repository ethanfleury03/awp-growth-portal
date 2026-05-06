import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function LeadsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('crm');
  return children;
}
