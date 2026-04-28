import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { getPortalUser } from '@/lib/auth/portal-user';
import { invoiceAmountsCents } from '@/lib/payments/invoice-money';
import { createInvoicePaymentCheckoutSession } from '@/lib/payments/payment-service';
import { invoicePaymentsAllowed } from '@/lib/payments/policy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const portal = await getPortalUser();
    if (!portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await auth();

    const { id } = await ctx.params;
    const rows = await sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`;
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const inv = rows[0] as Record<string, unknown>;
    if ((inv.company_id as string) !== portal.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const companyId = inv.company_id as string;
    if (!(await invoicePaymentsAllowed(companyId))) {
      return NextResponse.json({ error: 'Online invoice payment is not enabled in settings.' }, { status: 400 });
    }
    if ((inv.status as string) === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid.' }, { status: 400 });
    }

    const { totalCents } = invoiceAmountsCents(inv);
    if (totalCents <= 0) {
      return NextResponse.json({ error: 'Invalid invoice total.' }, { status: 400 });
    }

    const token = String(inv.public_pay_token || '');
    if (!token) {
      return NextResponse.json({ error: 'Invoice missing pay token' }, { status: 500 });
    }

    const custRows = await sql`
      SELECT email FROM customers WHERE id = ${inv.customer_id as string | null} LIMIT 1
    `;
    const email = (custRows[0] as { email?: string } | undefined)?.email ?? null;

    const result = await createInvoicePaymentCheckoutSession({
      invoiceId: id,
      invoiceNumber: String(inv.invoice_number),
      companyId,
      publicPayToken: token,
      amountCents: totalCents,
      customerEmail: email,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ url: result.url, paymentId: result.paymentId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
