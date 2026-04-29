import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getPortalUser } from '@/lib/auth/portal-user';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  const user = await getPortalUser();
  if (!user?.companyId) redirect('/account-unassigned');
  return <DashboardShell>{children}</DashboardShell>;
}
