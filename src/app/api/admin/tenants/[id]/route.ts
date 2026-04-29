import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { ensureCompanySettings } from '@/lib/workspace/workspace';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  await ensureCompanySettings(id);
  const rows = await sql`
    SELECT c.*, s.*
    FROM companies c
    LEFT JOIN company_settings s ON s.company_id = c.id
    WHERE c.id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  const row = rows[0] as Record<string, unknown>;
  return NextResponse.json({
    tenant: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      created_at: row.created_at,
      updated_at: row.updated_at,
      stripe_connect_status: row.stripe_connect_status,
      subscription_tier: row.subscription_tier,
      subscription_status: row.subscription_status,
      display_name: row.display_name ?? row.name,
      legal_name: row.legal_name ?? row.name,
      industry: row.industry ?? 'generic',
      timezone: row.timezone ?? 'America/New_York',
      logo_url: row.logo_url ?? null,
      primary_color: row.primary_color ?? '#ea580c',
      accent_color: row.accent_color ?? '#2563eb',
      portal_title: row.portal_title ?? 'WNY Automation Portal',
      workspace_label: row.workspace_label ?? 'Automation workspace',
      default_route: row.default_route ?? '/app',
      config_json: row.config_json ?? null,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = body?.phone === undefined ? undefined : String(body.phone || '').trim() || null;

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid contact email.' }, { status: 400 });
  }

  if (name || email || phone !== undefined) {
    if (phone === undefined) {
      await sql`
        UPDATE companies
        SET
          name = COALESCE(${name || null}, name),
          email = COALESCE(${email || null}, email),
          updated_at = datetime('now')
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE companies
        SET
          name = COALESCE(${name || null}, name),
          email = COALESCE(${email || null}, email),
          phone = ${phone},
          updated_at = datetime('now')
        WHERE id = ${id}
      `;
    }
  }

  const settings = body?.settings ?? {};
  await ensureCompanySettings(id);
  const currentSettings = await sql`
    SELECT logo_url, config_json
    FROM company_settings
    WHERE company_id = ${id}
    LIMIT 1
  `;
  const current = currentSettings[0] as { logo_url?: string | null; config_json?: string | null } | undefined;
  const logoUrl = settings.logoUrl === undefined ? current?.logo_url ?? null : settings.logoUrl || null;
  const configJson = settings.config === undefined ? current?.config_json ?? null : JSON.stringify(settings.config);

  await sql`
    UPDATE company_settings
    SET
      display_name = COALESCE(${settings.displayName ?? null}, display_name),
      legal_name = COALESCE(${settings.legalName ?? null}, legal_name),
      industry = COALESCE(${settings.industry ?? null}, industry),
      timezone = COALESCE(${settings.timezone ?? null}, timezone),
      logo_url = ${logoUrl},
      primary_color = COALESCE(${settings.primaryColor ?? null}, primary_color),
      accent_color = COALESCE(${settings.accentColor ?? null}, accent_color),
      portal_title = COALESCE(${settings.portalTitle ?? null}, portal_title),
      workspace_label = COALESCE(${settings.workspaceLabel ?? null}, workspace_label),
      default_route = COALESCE(${settings.defaultRoute ?? null}, default_route),
      config_json = ${configJson},
      updated_at = datetime('now')
    WHERE company_id = ${id}
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'tenant.update',
    entityType: 'company',
    entityId: id,
    summary: 'Updated tenant settings',
    metadata: body,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true });
}
