import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function ReceptionistLayout({ children }: { children: ReactNode }) {
  await requireModulePage('receptionist');
  return children;
}
