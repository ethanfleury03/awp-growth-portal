import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { invoiceAmountsCents } from '@/lib/payments/invoice-money';
import { createInvoicePaymentCheckoutSession } from '@/lib/payments/payment-service';
import { invoicePaymentsAllowed } from '@/lib/payments/policy';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

const bodySchema = z.object({
  email: z.string().email().optional(),
});

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const rl = consumePublicRateLimit(
      publicActionKey(request, token, 'invoice-checkout'),
      max,
      windowMs,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const rows = await sql`
      SELECT * FROM invoices WHERE public_pay_token = ${token} LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const inv = rows[0] as Record<string, unknown>;
    const companyId = inv.company_id as string;
    if (!(await invoicePaymentsAllowed(companyId))) {
      return NextResponse.json({ error: 'Online invoice payment is not enabled.' }, { status: 400 });
    }
    if ((inv.status as string) === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid.' }, { status: 400 });
    }

    const { totalCents } = invoiceAmountsCents(inv);
    if (totalCents <= 0) {
      return NextResponse.json({ error: 'Invalid invoice total.' }, { status: 400 });
    }

    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);
    const custRows = await sql`
      SELECT email FROM customers WHERE id = ${inv.customer_id as string | null} LIMIT 1
    `;
    const custEmail = (custRows[0] as { email?: string } | undefined)?.email ?? null;
    const email = body.email?.trim() || custEmail;

    const result = await createInvoicePaymentCheckoutSession({
      invoiceId: inv.id as string,
      invoiceNumber: String(inv.invoice_number),
      companyId,
      publicPayToken: token,
      amountCents: totalCents,
      customerEmail: email,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ url: result.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
