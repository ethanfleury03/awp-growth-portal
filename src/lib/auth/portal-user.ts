import { auth, currentUser } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';

/**
 * Portal user for API routes and `/api/auth/me` — Clerk session plus optional
 * `portal_users` row matched by email for company/role.
 */
export async function getPortalUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
  if (!email) return null;

  const meta = user.publicMetadata as Record<string, unknown> | undefined;
  const roleMeta = meta?.role as SessionUser['role'] | undefined;
  const companyMeta = meta?.companyId as string | undefined;
  const branchMeta = meta?.branchId as string | undefined;

  let companyId = companyMeta?.trim() || '';
  let branchId = branchMeta?.trim() || '';
  let role: SessionUser['role'] = roleMeta || 'staff';
  let portalRowId: string | null = null;

  const rows = await sql`
    SELECT id, company_id, role FROM portal_users
    WHERE clerk_user_id = ${userId} OR lower(email) = ${email.toLowerCase()}
    ORDER BY (clerk_user_id = ${userId}) DESC
    LIMIT 1
  `;
  const row = rows[0] as { id?: string; company_id?: string; role?: string } | undefined;
  if (row) {
    portalRowId = String(row.id);
    if (row.company_id) companyId = String(row.company_id);
    if (row.role) role = row.role as SessionUser['role'];
  }

  if (portalRowId && companyId) {
    const memberships = await sql`
      SELECT branch_id, role
      FROM user_memberships
      WHERE user_id = ${portalRowId}
        AND company_id = ${companyId}
        AND status = 'active'
      ORDER BY CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END, datetime(created_at) ASC
      LIMIT 1
    `;
    const membership = memberships[0] as { branch_id?: string; role?: string } | undefined;
    if (membership?.branch_id) branchId = String(membership.branch_id);
    if (membership?.role) role = membership.role as SessionUser['role'];
  }

  if (!companyId) {
    const c = await sql`SELECT id FROM companies ORDER BY datetime(created_at) LIMIT 1`;
    companyId = String((c[0] as { id?: string } | undefined)?.id || '');
  }

  if (!branchId && companyId) {
    const branches = await sql`
      SELECT id
      FROM branches
      WHERE company_id = ${companyId}
      ORDER BY is_primary DESC, datetime(created_at) ASC
      LIMIT 1
    `;
    branchId = String((branches[0] as { id?: string } | undefined)?.id || '');
  }

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    email;
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || email.slice(0, 2).toUpperCase();

  return {
    id: portalRowId || userId,
    email,
    name,
    role,
    companyId,
    branchId: branchId || null,
    avatarInitials: initials,
  };
}
