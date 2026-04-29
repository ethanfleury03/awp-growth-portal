import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const users = await sql`
    SELECT email, clerk_user_id, name, first_seen_at, last_seen_at, assigned_at, assigned_company_id
    FROM unassigned_portal_users
    WHERE assigned_at IS NULL
    ORDER BY last_seen_at DESC
    LIMIT 100
  `;
  return NextResponse.json({ users });
}
