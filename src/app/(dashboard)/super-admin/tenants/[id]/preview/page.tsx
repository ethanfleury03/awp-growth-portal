import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye, Lock, ArrowLeft } from 'lucide-react';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { getCompanyWorkspaceForCompanyId } from '@/lib/workspace/workspace';
import { MODULE_BY_KEY } from '@/lib/modules/catalog';

export default async function TenantPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) redirect('/app');
  const { id } = await params;
  const workspace = await getCompanyWorkspaceForCompanyId(id, 'viewer');

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <header className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
        <Link href={`/super-admin/tenants/${id}`} className="mb-3 inline-flex items-center gap-2 text-sm text-orange-800 hover:text-orange-950">
          <ArrowLeft className="h-4 w-4" /> Back to tenant admin
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
              <Eye className="h-3.5 w-3.5" /> Preview mode
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">
              Previewing {workspace.branding.displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              This is a read-only workspace preview. Tenant data writes are disabled in this view.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-medium text-orange-800">
            <Lock className="h-4 w-4" /> Read only
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <aside className="overflow-hidden rounded-xl bg-slate-950 text-white">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: workspace.branding.primaryColor }}
              >
                {(workspace.branding.displayName || 'WNY').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{workspace.branding.portalTitle}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {workspace.branding.displayName}
                </div>
              </div>
            </div>
          </div>
          <nav className="space-y-1 p-3">
            {workspace.enabledModules.map((key, idx) => {
              const mod = MODULE_BY_KEY.get(key);
              return (
                <div
                  key={key}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={idx === 0 ? { background: workspace.branding.accentColor } : undefined}
                >
                  {mod?.label ?? key}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workspace</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <PreviewMetric label="Default route" value={workspace.defaultRoute} />
              <PreviewMetric label="Industry" value={workspace.industry} />
              <PreviewMetric label="Enabled modules" value={String(workspace.enabledModules.length)} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Client-facing frame</h2>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="mb-3 text-lg font-semibold text-slate-950">{workspace.branding.workspaceLabel}</div>
              <div className="grid gap-3 md:grid-cols-3">
                {['Leads', 'Customers', 'Tasks'].map((label) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 h-2 rounded-full" style={{ background: workspace.branding.accentColor }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}
