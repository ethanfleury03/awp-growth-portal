import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.created_at,
      c.stripe_connect_status,
      (SELECT COUNT(*) FROM portal_users WHERE company_id = c.id) AS user_count,
      (SELECT COUNT(*) FROM invoices WHERE company_id = c.id) AS invoice_count,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE company_id = c.id AND status = 'paid') AS paid_cents
    FROM companies c
    ORDER BY datetime(c.created_at) DESC
  `;
  return NextResponse.json({ tenants: rows });
}
