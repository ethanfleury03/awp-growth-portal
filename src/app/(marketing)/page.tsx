import { redirect } from 'next/navigation';
import { PORTAL_APP_PATH } from '@/lib/auth/portal-entry-host';

export default function PortalEntryPage() {
  redirect(PORTAL_APP_PATH);
}
