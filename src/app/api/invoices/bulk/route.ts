import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { enforceAuthedRateLimit } from '@/lib/rate-limit';

const ALLOWED_STATUS = new Set(['pending', 'paid', 'overdue', 'cancelled']);

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('staff');
  if (isPortalResponse(auth)) return auth;
  const limited = enforceAuthedRateLimit({ user: auth, action: 'invoice.bulk', max: 20, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((v: unknown): v is string => typeof v === 'string')
    : [];
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  if (ids.length > 500) return NextResponse.json({ error: 'Too many (max 500)' }, { status: 400 });

  // Run per-id (portable across SQLite + Postgres without dialect-specific IN
  // placeholder juggling). Scoped to company_id so cross-tenant ids silently
  // no-op rather than erroring.
  const meta = auditFromRequest(request);

  if (action === 'delete') {
    let count = 0;
    for (const id of ids) {
      await sql`DELETE FROM invoices WHERE company_id = ${auth.companyId} AND id = ${id}`;
      count++;
    }
    await writeAudit({
      actor: auth,
      action: 'invoice.bulk',
      entityType: 'invoice',
      summary: `Bulk delete: ${count} invoice(s)`,
      metadata: { ids, action: 'delete', count },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ ok: true, count });
  }

  if (action === 'set_status') {
    const status = String(body?.status || '');
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    let count = 0;
    for (const id of ids) {
      await sql`
        UPDATE invoices
        SET status = ${status}, updated_at = datetime('now')
        WHERE company_id = ${auth.companyId} AND id = ${id}
      `;
      count++;
    }
    await writeAudit({
      actor: auth,
      action: 'invoice.bulk',
      entityType: 'invoice',
      summary: `Bulk set_status ${status}: ${count} invoice(s)`,
      metadata: { ids, action: 'set_status', status, count },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
