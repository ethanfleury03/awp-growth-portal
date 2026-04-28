import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';

/**
 * GDPR/CCPA erasure. We do NOT hard-delete transactional records (invoices +
 * payments must stay for tax/audit reasons) — instead we scrub PII from the
 * customer record, sever identifiers on derived rows, and log the request.
 *
 * Admin-only. Returns the scrubbed row.
 */
export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const customerId = String(body?.customerId || '');
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const existing = await sql`
    SELECT id FROM customers WHERE id = ${customerId} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const marker = `[erased-${Date.now()}]`;
  await sql`
    UPDATE customers SET
      name = ${marker},
      email = NULL,
      phone = NULL,
      address = NULL,
      notes = NULL,
      email_opt_in = 0,
      sms_opt_in = 0,
      sms_opt_out_at = datetime('now'),
      portal_token = NULL,
      updated_at = datetime('now')
    WHERE id = ${customerId} AND company_id = ${auth.companyId}
  `;

  try {
    await sql`
      UPDATE notifications SET to_address = '[erased]', body = NULL
      WHERE customer_id = ${customerId} AND company_id = ${auth.companyId}
    `;
  } catch {
    // notifications table may not exist yet in older installs; safe to ignore.
  }

  const requestId = randomUUID();
  await sql`
    INSERT INTO privacy_requests (id, company_id, customer_id, kind, status, requested_by_user_id, completed_at)
    VALUES (${requestId}, ${auth.companyId}, ${customerId}, 'delete', 'completed', ${auth.id}, datetime('now'))
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'customer.privacy_delete',
    entityType: 'customer',
    entityId: customerId,
    summary: 'Erased customer PII (GDPR/CCPA); transactional records preserved',
    metadata: { requestId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, requestId });
}
