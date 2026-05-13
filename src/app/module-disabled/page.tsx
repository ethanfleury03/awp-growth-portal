import Link from 'next/link';
import { MODULE_BY_KEY, type ModuleKey } from '@/lib/modules/catalog';

export default async function ModuleDisabledPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; reason?: string }>;
}) {
  const { module, reason } = await searchParams;
  const mod = MODULE_BY_KEY.get(module as ModuleKey);
  const label = mod?.label ?? 'This module';
  const roleBlocked = reason === 'role';
  const unassigned = reason === 'unassigned';
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          {roleBlocked ? 'Permission needed' : unassigned ? 'Account setup needed' : 'Module not enabled'}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {roleBlocked
            ? `${label} needs a higher portal role.`
            : unassigned
              ? 'Your login is not assigned to a workspace yet.'
              : `${label} is not available for this workspace.`}
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {roleBlocked
            ? 'Your account is active, but this area is limited to a higher workspace role. Ask a WNY Automation admin to update your portal role if you need access.'
            : unassigned
              ? 'WNY Automation needs to connect your email to a client CRM before you can use this area.'
              : 'This client CRM does not currently include that module. A WNY Automation super admin can enable it from the tenant module settings.'}
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
