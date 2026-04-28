import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 500);

  const rows = status
    ? await sql`
        SELECT id, source_type, source_id, stripe_payment_intent_id,
               stripe_account_id, amount_cents, refunded_amount_cents,
               application_fee_cents, currency, status, customer_email,
               paid_at, refunded_at, failed_at, created_at
        FROM payments
        WHERE company_id = ${auth.companyId} AND status = ${status}
        ORDER BY datetime(created_at) DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, source_type, source_id, stripe_payment_intent_id,
               stripe_account_id, amount_cents, refunded_amount_cents,
               application_fee_cents, currency, status, customer_email,
               paid_at, refunded_at, failed_at, created_at
        FROM payments
        WHERE company_id = ${auth.companyId}
        ORDER BY datetime(created_at) DESC
        LIMIT ${limit}
      `;

  return NextResponse.json({ payments: rows });
}
