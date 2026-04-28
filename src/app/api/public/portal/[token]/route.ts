import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Public customer portal endpoint. Authenticated only by the customer's
 * `portal_token`; scoped to that customer. Lists their invoices, estimates,
 * and jobs so they can self-serve.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const customerRows = await sql`
    SELECT id, company_id, name, email, phone, address
    FROM customers WHERE portal_token = ${token} LIMIT 1
  `;
  const customer = customerRows[0] as Record<string, unknown> | undefined;
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const companyId = String(customer.company_id);
  const customerId = String(customer.id);

  const [companyRows, invoices, estimates, jobs] = await Promise.all([
    sql`SELECT name, email, phone FROM companies WHERE id = ${companyId} LIMIT 1`,
    sql`
      SELECT id, invoice_number, status, total_cents, issue_date, due_date, public_pay_token
      FROM invoices
      WHERE customer_id = ${customerId} AND company_id = ${companyId}
      ORDER BY datetime(created_at) DESC
      LIMIT 50
    `,
    sql`
      SELECT id, estimate_number, status, total_cents, customer_public_token, issued_at
      FROM estimates
      WHERE customer_id = ${customerId} AND company_id = ${companyId}
      ORDER BY datetime(created_at) DESC
      LIMIT 50
    `,
    sql`
      SELECT id, description, status, scheduled_at, type AS service_type
      FROM jobs
      WHERE customer_id = ${customerId} AND company_id = ${companyId}
      ORDER BY datetime(created_at) DESC
      LIMIT 50
    `,
  ]);

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    company: companyRows[0] ?? null,
    invoices,
    estimates,
    jobs,
  });
}
