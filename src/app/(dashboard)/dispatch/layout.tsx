import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function DispatchLayout({ children }: { children: ReactNode }) {
  await requireModulePage('dispatch');
  return children;
}
