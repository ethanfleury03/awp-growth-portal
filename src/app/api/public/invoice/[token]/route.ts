import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { listLineItemsForInvoiceIds } from '@/lib/invoices/invoice-line-items';
import { invoiceAmountsCents } from '@/lib/payments/invoice-money';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const rows = await sql`
      SELECT
        i.id,
        i.company_id,
        i.invoice_number,
        i.status,
        i.issue_date,
        i.due_date,
        i.amount,
        i.tax,
        i.total,
        i.amount_cents,
        i.tax_cents,
        i.total_cents,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.public_pay_token = ${token}
      LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const row = rows[0] as Record<string, unknown>;
    const cents = invoiceAmountsCents(row);
    const invId = row.id as string;
    const lineItems = listLineItemsForInvoiceIds([invId]).filter((r) => r.invoice_id === invId);
    return NextResponse.json({
      invoice: {
        invoice_number: row.invoice_number,
        status: row.status,
        issue_date: row.issue_date,
        due_date: row.due_date,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        line_items: lineItems,
        ...cents,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
