import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const resolved = url.searchParams.get('resolved') === '1';
  const rows = await sql`
    SELECT id, company_id, provider, event_id, event_type, error_message,
           attempt_count, resolved_at, created_at, updated_at
    FROM webhook_failures
    WHERE ${resolved ? sql`resolved_at IS NOT NULL` : sql`resolved_at IS NULL`}
    ORDER BY datetime(created_at) DESC
    LIMIT 200
  `;
  return NextResponse.json({ failures: rows });
}
