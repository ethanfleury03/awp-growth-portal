import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function CalendarLayout({ children }: { children: ReactNode }) {
  await requireModulePage('calendar');
  return children;
}
