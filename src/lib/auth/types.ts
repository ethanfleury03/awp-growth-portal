/**
 * Auth types. The session layer is Clerk; these types describe the post-login
 * portal user after enrichment from `portal_users` / `user_memberships`.
 */

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'dispatcher'
  | 'staff'
  | 'tech'
  | 'viewer';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  branchId: string | null;
  avatarInitials: string;
};

export type MeResponse =
  | { authenticated: true; user: SessionUser }
  | { authenticated: false };

export const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  tech: 10,
  staff: 20,
  dispatcher: 30,
  admin: 40,
  super_admin: 99,
};

export function roleAtLeast(role: UserRole, required: UserRole): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[required] ?? 0);
}
