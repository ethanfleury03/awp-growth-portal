import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function GET() {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const rows = await sql`
    SELECT id, email, name, role, is_active, clerk_user_id, created_at
    FROM portal_users
    WHERE company_id = ${auth.companyId}
    ORDER BY datetime(created_at) ASC
  `;
  return NextResponse.json({ members: rows });
}
