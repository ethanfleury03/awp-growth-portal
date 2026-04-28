import { NextResponse } from 'next/server';
import { getPortalUser } from '@/lib/auth/portal-user';
import type { SessionUser, UserRole } from '@/lib/auth/types';
import { roleAtLeast } from '@/lib/auth/types';

export type TenantContext = Pick<SessionUser, 'id' | 'companyId' | 'branchId' | 'role'>;

export async function requirePortalUser(): Promise<SessionUser> {
  const user = await getPortalUser();
  if (!user?.companyId) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireTenantContext(): Promise<TenantContext> {
  const user = await requirePortalUser();
  return {
    id: user.id,
    companyId: user.companyId,
    branchId: user.branchId,
    role: user.role,
  };
}

export function hasRequiredRole(
  role: UserRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return allowedRoles.includes(role);
}

/**
 * Shortcut for API routes. Returns either a `SessionUser` or a `NextResponse`
 * with the appropriate 401/403. When `minRole` is set, returns 403 if the user
 * does not meet that bar.
 */
export async function requirePortalOrRespond(
  minRole?: UserRole,
): Promise<SessionUser | NextResponse> {
  const user = await getPortalUser().catch(() => null);
  if (!user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (minRole && !roleAtLeast(user.role, minRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

export function isPortalResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export async function requireSuperAdmin(): Promise<SessionUser | NextResponse> {
  return requirePortalOrRespond('super_admin');
}
