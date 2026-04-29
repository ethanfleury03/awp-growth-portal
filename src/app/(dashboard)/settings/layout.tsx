import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireModulePage('settings');
  return children;
}
