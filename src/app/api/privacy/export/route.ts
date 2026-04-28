import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';

/**
 * Return a full JSON dump of everything we hold about a single customer.
 * Scoped to the caller's company. Admin-only. Used to satisfy GDPR/CCPA
 * data-portability requests.
 */
export async function GET(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId') || '';
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const customerRows = await sql`
    SELECT * FROM customers WHERE id = ${customerId} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!customerRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const safe = <T>(p: PromiseLike<T>): Promise<T | []> =>
    Promise.resolve(p).then(
      (v) => v,
      () => [] as unknown as T,
    );

  const [invoices, estimates, jobs, payments, calls, attachments, notifications] = await Promise.all([
    sql`SELECT * FROM invoices WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`,
    sql`SELECT * FROM estimates WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`,
    sql`SELECT * FROM jobs WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`,
    sql`SELECT * FROM payments WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`,
    safe(sql`SELECT * FROM receptionist_calls WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`),
    safe(sql`SELECT * FROM attachments WHERE entity_type = 'customer' AND entity_id = ${customerId} AND company_id = ${auth.companyId}`),
    safe(sql`SELECT id, channel, template, to_address, status, sent_at, created_at FROM notifications WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}`),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    company_id: auth.companyId,
    customer: customerRows[0],
    invoices,
    estimates,
    jobs,
    payments,
    receptionist_calls: calls,
    attachments,
    notifications,
  };

  const meta = auditFromRequest(request);
  const requestId = randomUUID();
  await sql`
    INSERT INTO privacy_requests (id, company_id, customer_id, kind, status, requested_by_user_id, completed_at, payload)
    VALUES (${requestId}, ${auth.companyId}, ${customerId}, 'export', 'completed', ${auth.id}, datetime('now'), ${JSON.stringify({ tables: Object.keys(payload) })})
  `;
  await writeAudit({
    actor: auth,
    action: 'customer.privacy_export',
    entityType: 'customer',
    entityId: customerId,
    summary: 'Exported customer data (GDPR/CCPA)',
    metadata: { requestId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="customer-${customerId}-export.json"`,
    },
  });
}
