import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function JobsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('jobs');
  return children;
}
