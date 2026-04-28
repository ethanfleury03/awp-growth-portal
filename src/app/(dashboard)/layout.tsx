import { auth } from '@clerk/nextjs/server';
import { DashboardShell } from '@/components/dashboard-shell';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  return <DashboardShell>{children}</DashboardShell>;
}
