import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getAdminPortalUrl } from '@/lib/auth/admin-redirect';
import { getPortalUser } from '@/lib/auth/portal-user';
import { canAccessStaging } from '@/lib/staging/access';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = await getPortalUser();
  if (!user) {
    await auth.protect();
    user = await getPortalUser();
  }
  if (user?.role === 'super_admin') redirect(getAdminPortalUrl('/admin'));
  if (!user?.companyId) redirect('/account-unassigned');
  if (!canAccessStaging(user.role)) redirect('/module-disabled?module=staging&reason=role');
  return <DashboardShell>{children}</DashboardShell>;
}
