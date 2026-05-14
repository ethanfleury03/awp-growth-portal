import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getAdminPortalHref, isAdminPortalHost } from '@/lib/auth/admin-portal';
import { getPortalUser } from '@/lib/auth/portal-user';
import { canAccessStaging } from '@/lib/staging/access';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  const user = await getPortalUser();
  if (!user?.companyId && user?.role !== 'super_admin') redirect('/account-unassigned');
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || '';
  if (user?.role === 'super_admin' && !isAdminPortalHost(host)) {
    redirect(getAdminPortalHref('/super-admin'));
  }
  if (!canAccessStaging(user.role)) redirect('/module-disabled?module=staging&reason=role');
  return <DashboardShell>{children}</DashboardShell>;
}
