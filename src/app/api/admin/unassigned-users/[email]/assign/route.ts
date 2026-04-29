import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import type { UserRole } from '@/lib/auth/types';

const ALLOWED_ROLES: UserRole[] = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { email: encodedEmail } = await params;
  const email = decodeURIComponent(encodedEmail).trim().toLowerCase();
  const body = await request.json().catch(() => ({}));
  const companyId = String(body?.companyId || '').trim();
  const role = String(body?.role || 'staff').trim() as UserRole;
  if (!email || !companyId) {
    return NextResponse.json({ error: 'Email and company are required.' }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Choose a valid role.' }, { status: 400 });
  }
  const company = await sql`SELECT id FROM companies WHERE id = ${companyId} LIMIT 1`;
  if (!company[0]) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const unassigned = await sql`
    SELECT email, name, clerk_user_id
    FROM unassigned_portal_users
    WHERE email = ${email}
    LIMIT 1
  `;
  const source = unassigned[0] as { name?: string; clerk_user_id?: string } | undefined;
  const name = String(body?.name || source?.name || email);
  const clerkUserId = String(source?.clerk_user_id || '') || null;

  const existing = await sql`SELECT id FROM portal_users WHERE lower(email) = ${email} LIMIT 1`;
  let userId = String((existing[0] as { id?: string } | undefined)?.id || '');
  if (userId) {
    await sql`
      UPDATE portal_users
      SET company_id = ${companyId}, name = ${name}, role = ${role}, is_active = true, updated_at = datetime('now')
      WHERE id = ${userId}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO portal_users (company_id, email, name, hashed_pw, role, is_active, clerk_user_id)
      VALUES (${companyId}, ${email}, ${name}, '', ${role}, true, ${clerkUserId})
      RETURNING id
    `;
    userId = String((inserted[0] as { id?: string }).id);
  }

  const membership = await sql`
    SELECT user_id FROM user_memberships
    WHERE user_id = ${userId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (membership[0]) {
    await sql`
      UPDATE user_memberships
      SET role = ${role}, status = 'active', updated_at = datetime('now')
      WHERE user_id = ${userId} AND company_id = ${companyId}
    `;
  } else {
    await sql`
      INSERT INTO user_memberships (user_id, company_id, role, status)
      VALUES (${userId}, ${companyId}, ${role}, 'active')
    `;
  }
  await sql`
    UPDATE unassigned_portal_users
    SET assigned_at = datetime('now'), assigned_company_id = ${companyId}, assigned_user_id = ${userId}
    WHERE email = ${email}
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'tenant.user.assign',
    entityType: 'portal_user',
    entityId: userId,
    summary: `Assigned unassigned user ${email}`,
    metadata: { email, companyId, role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ id: userId });
}
