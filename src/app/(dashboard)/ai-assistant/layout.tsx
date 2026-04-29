import type { ReactNode } from 'react';
import { requireModulePage } from '@/lib/modules/access';

export default async function AiAssistantLayout({ children }: { children: ReactNode }) {
  await requireModulePage('ai-assistant');
  return children;
}
