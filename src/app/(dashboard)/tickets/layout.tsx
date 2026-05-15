import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function TicketsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('tickets');
  return children;
}
