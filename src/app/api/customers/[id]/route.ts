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
    const customerRows = await sql`
      SELECT *
      FROM customers
      WHERE id = ${id} AND company_id = ${portal.companyId}
    `;
    if (customerRows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const jobs = await sql`
      SELECT *
      FROM jobs
      WHERE customer_id = ${id} AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;
    const invoices = await sql`
      SELECT *
      FROM invoices
      WHERE customer_id = ${id} AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;
    const estimates = await sql`
      SELECT
        id,
        estimate_number,
        title,
        status,
        total_amount_cents,
        created_at,
        updated_at,
        sent_at,
        customer_public_token
      FROM estimates
      WHERE customer_id = ${id}
        AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      customer: customerRows[0],
      jobs,
      invoices,
      estimates,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
