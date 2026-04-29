import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { MODULE_CATALOG, expandModuleDependencies, moduleFlagKey, type ModuleKey } from '@/lib/modules/catalog';
import { getEnabledModules } from '@/lib/workspace/workspace';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({
    catalog: MODULE_CATALOG,
    enabledModules: await getEnabledModules(id),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const requested = (Array.isArray(body?.enabledModules) ? body.enabledModules : []) as ModuleKey[];
  const validKeys = new Set(MODULE_CATALOG.map((m) => m.key));
  const invalid = requested.filter((key) => !validKeys.has(key));
  if (invalid.length) {
    return NextResponse.json({ error: `Unknown module: ${invalid[0]}` }, { status: 400 });
  }
  const valid = requested.filter((key) => validKeys.has(key));
  const enabledModules = expandModuleDependencies(valid);

  for (const mod of MODULE_CATALOG) {
    await sql`
      INSERT INTO feature_flags (company_id, flag_key, enabled, payload_json)
      VALUES (${id}, ${moduleFlagKey(mod.key)}, ${enabledModules.includes(mod.key)}, null)
      ON CONFLICT (company_id, flag_key) DO UPDATE SET
        enabled = excluded.enabled,
        updated_at = datetime('now')
    `;
  }

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'tenant.modules.update',
    entityType: 'company',
    entityId: id,
    summary: 'Updated tenant modules',
    metadata: { enabledModules },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ enabledModules });
}
