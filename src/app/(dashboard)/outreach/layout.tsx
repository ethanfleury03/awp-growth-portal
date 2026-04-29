import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function OutreachLayout({ children }: { children: ReactNode }) {
  await requireModulePage('outreach');
  return children;
}
