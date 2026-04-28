import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requirePortalUser } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const leadRows = await sql`
      SELECT
        l.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.id = ${id} AND l.company_id = ${portal.companyId}
    `;
    if (leadRows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const estimates = await sql`
      SELECT id, estimate_number, title, status, total_amount_cents, created_at, customer_public_token
      FROM estimates
      WHERE lead_id = ${id} AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;
    const jobs = await sql`
      SELECT id, type, status, scheduled_date, estimated_price, created_at
      FROM jobs
      WHERE lead_id = ${id} AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({
      lead: leadRows[0],
      estimates,
      jobs,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
