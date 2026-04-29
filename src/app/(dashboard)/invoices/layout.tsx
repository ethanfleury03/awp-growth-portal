import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function InvoicesLayout({ children }: { children: ReactNode }) {
  await requireModulePage('invoices');
  return children;
}
