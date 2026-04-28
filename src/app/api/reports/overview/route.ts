import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || '30'), 1), 365);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [invoiceAgg, paymentAgg, jobAgg, leadAgg] = await Promise.all([
    sql`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(total_cents), 0) AS total_cents,
        COALESCE(SUM(CASE WHEN status='paid' THEN total_cents ELSE 0 END), 0) AS paid_cents,
        COALESCE(SUM(CASE WHEN status='pending' THEN total_cents ELSE 0 END), 0) AS pending_cents
      FROM invoices
      WHERE company_id = ${auth.companyId} AND datetime(created_at) >= ${since}
    `,
    sql`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END), 0) AS paid_cents,
        COALESCE(SUM(refunded_amount_cents), 0) AS refunded_cents,
        COALESCE(SUM(application_fee_cents), 0) AS fee_cents
      FROM payments
      WHERE company_id = ${auth.companyId} AND datetime(created_at) >= ${since}
    `,
    sql`
      SELECT
        COUNT(*) AS count,
        COUNT(CASE WHEN status='completed' THEN 1 END) AS completed,
        COUNT(CASE WHEN status='in_progress' THEN 1 END) AS in_progress,
        COUNT(CASE WHEN status='cancelled' THEN 1 END) AS cancelled
      FROM jobs
      WHERE company_id = ${auth.companyId} AND datetime(created_at) >= ${since}
    `,
    sql`
      SELECT
        COUNT(*) AS count,
        COUNT(CASE WHEN status='new' THEN 1 END) AS new_count,
        COUNT(CASE WHEN status='converted' THEN 1 END) AS converted
      FROM leads
      WHERE company_id = ${auth.companyId} AND datetime(created_at) >= ${since}
    `,
  ]);

  return NextResponse.json({
    days,
    invoices: invoiceAgg[0],
    payments: paymentAgg[0],
    jobs: jobAgg[0],
    leads: leadAgg[0],
  });
}
