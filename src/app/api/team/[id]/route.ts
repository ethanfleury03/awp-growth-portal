import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import type { UserRole } from '@/lib/auth/types';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';

const ALLOWED_ROLES: UserRole[] = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const role = typeof body?.role === 'string' ? (body.role as UserRole) : null;
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;

  if (role && !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const rows = await sql`
    SELECT id FROM portal_users WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const meta = auditFromRequest(request);
  if (role !== null) {
    await sql`
      UPDATE portal_users SET role = ${role}, updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;
    await writeAudit({
      actor: auth,
      action: 'team.role_change',
      entityType: 'portal_user',
      entityId: id,
      summary: `Role set to ${role}`,
      metadata: { role },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  if (isActive !== null) {
    await sql`
      UPDATE portal_users SET is_active = ${isActive ? 1 : 0}, updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;
    await writeAudit({
      actor: auth,
      action: 'team.deactivate',
      entityType: 'portal_user',
      entityId: id,
      summary: isActive ? 'Reactivated user' : 'Deactivated user',
      metadata: { isActive },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  if (id === auth.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }
  await sql`
    UPDATE portal_users SET is_active = 0, updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${auth.companyId}
  `;
  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'team.deactivate',
    entityType: 'portal_user',
    entityId: id,
    summary: 'Deactivated user',
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true });
}
