import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function AssetsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('assets');
  return children;
}
