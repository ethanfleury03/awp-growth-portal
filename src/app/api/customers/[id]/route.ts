import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { normalizeCustomerPayload } from '@/lib/customers/validation';
import { requireModuleOrRespond } from '@/lib/modules/access';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const { id } = await params;
  const parsed = normalizeCustomerPayload(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const customer = parsed.value;

  try {
    const existing = await sql`
      SELECT id FROM customers
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const result = await sql`
      UPDATE customers
      SET name = ${customer.name},
          email = ${customer.email},
          phone = ${customer.phone},
          address = ${customer.address},
          notes = ${customer.notes},
          updated_at = NOW()
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING *
    `;

    return NextResponse.json({ customer: result[0] });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const { id } = await params;

  try {
    const deleted = await sql`
      DELETE FROM customers
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING id
    `;
    if (!deleted.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
