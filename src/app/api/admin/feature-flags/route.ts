import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const companyId = url.searchParams.get('companyId');

  if (companyId) {
    const rows = await sql`
      SELECT company_id, flag_key, enabled, payload, updated_at
      FROM feature_flags WHERE company_id = ${companyId}
      ORDER BY flag_key
    `;
    return NextResponse.json({ flags: rows });
  }
  const rows = await sql`
    SELECT company_id, flag_key, enabled, payload, updated_at
    FROM feature_flags ORDER BY company_id, flag_key
  `;
  return NextResponse.json({ flags: rows });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const companyId = String(body?.companyId || '').trim();
  const flagKey = String(body?.flagKey || '').trim();
  const enabled = Boolean(body?.enabled);
  const payload = body?.payload ? JSON.stringify(body.payload) : null;
  if (!companyId || !flagKey) {
    return NextResponse.json({ error: 'companyId + flagKey required' }, { status: 400 });
  }

  const existing = await sql`
    SELECT flag_key FROM feature_flags
    WHERE company_id = ${companyId} AND flag_key = ${flagKey}
    LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`
      UPDATE feature_flags
      SET enabled = ${enabled ? 1 : 0}, payload = ${payload}, updated_at = datetime('now')
      WHERE company_id = ${companyId} AND flag_key = ${flagKey}
    `;
  } else {
    await sql`
      INSERT INTO feature_flags (company_id, flag_key, enabled, payload)
      VALUES (${companyId}, ${flagKey}, ${enabled ? 1 : 0}, ${payload})
    `;
  }

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'feature_flag.update',
    entityType: 'company',
    entityId: companyId,
    summary: `${flagKey} = ${enabled}`,
    metadata: { flagKey, enabled, payload: body?.payload ?? null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true });
}
