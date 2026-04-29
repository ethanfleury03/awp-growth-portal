import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  await requireModulePage('customers');
  return children;
}
