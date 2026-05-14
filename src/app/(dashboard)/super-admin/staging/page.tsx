import { redirect } from 'next/navigation';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { StagingAdminClient } from './staging-admin-client';

export default async function SuperAdminStagingPage() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) {
    redirect('/module-disabled?module=staging&reason=role');
  }
  return <StagingAdminClient />;
}
