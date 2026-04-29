import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('reports');
  return children;
}
