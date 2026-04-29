import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import type { UserRole } from '@/lib/auth/types';

const ALLOWED_ROLES: UserRole[] = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id, userId } = await params;
  const body = await request.json().catch(() => ({}));
  const role = body?.role === undefined ? null : String(body.role || 'staff');
  const isActive = body?.isActive === undefined ? null : Boolean(body.isActive);
  const name = body?.name === undefined ? null : String(body.name || '');
  if (role && !ALLOWED_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'Choose a valid role.' }, { status: 400 });
  }
  await sql`
    UPDATE portal_users
    SET
      role = COALESCE(${role}, role),
      name = COALESCE(${name}, name),
      is_active = COALESCE(${isActive}, is_active),
      updated_at = datetime('now')
    WHERE id = ${userId} AND company_id = ${id}
  `;
  if (role) {
    await sql`
      UPDATE user_memberships
      SET role = ${role}, updated_at = datetime('now')
      WHERE user_id = ${userId} AND company_id = ${id}
    `;
  }
  if (isActive !== null) {
    await sql`
      UPDATE user_memberships
      SET status = ${isActive ? 'active' : 'inactive'}, updated_at = datetime('now')
      WHERE user_id = ${userId} AND company_id = ${id}
    `;
  }
  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'tenant.user.update',
    entityType: 'portal_user',
    entityId: userId,
    summary: 'Updated tenant user',
    metadata: body,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true });
}
