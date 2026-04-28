import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

/** Dispatch view: jobs + plumbers with a window of scheduled_at. */
export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const day = url.searchParams.get('day') || new Date().toISOString().slice(0, 10);
  const start = `${day} 00:00:00`;
  const end = `${day} 23:59:59`;

  const [jobs, plumbers] = await Promise.all([
    sql`
      SELECT j.id, j.description, j.type AS service_type, j.status, j.scheduled_at,
             j.plumber_id, j.customer_id,
             c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
             p.name AS plumber_name
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN plumbers p ON p.id = j.plumber_id
      WHERE j.company_id = ${auth.companyId}
        AND (j.scheduled_at IS NULL OR (j.scheduled_at >= ${start} AND j.scheduled_at <= ${end}))
      ORDER BY (CASE WHEN j.scheduled_at IS NULL THEN 1 ELSE 0 END), j.scheduled_at
      LIMIT 200
    `,
    sql`
      SELECT id, name, role AS specialty, active AS is_active
      FROM plumbers WHERE company_id = ${auth.companyId}
      ORDER BY datetime(created_at) ASC
    `,
  ]);

  return NextResponse.json({ jobs, plumbers, day });
}

export async function PUT(request: Request) {
  const auth = await requirePortalOrRespond('dispatcher');
  if (isPortalResponse(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  const jobId = String(body?.jobId || '');
  const plumberId = body?.plumberId === null ? null : String(body?.plumberId || '');
  const scheduledAt = body?.scheduledAt === null ? null : body?.scheduledAt ? String(body.scheduledAt) : undefined;
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const rows = await sql`
    SELECT id FROM jobs WHERE id = ${jobId} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (plumberId !== undefined) {
    if (plumberId) {
      const p = await sql`
        SELECT id FROM plumbers WHERE id = ${plumberId} AND company_id = ${auth.companyId} LIMIT 1
      `;
      if (!p.length) return NextResponse.json({ error: 'Plumber not in your company' }, { status: 400 });
    }
    await sql`
      UPDATE jobs SET plumber_id = ${plumberId}, updated_at = datetime('now')
      WHERE id = ${jobId} AND company_id = ${auth.companyId}
    `;
  }
  if (scheduledAt !== undefined) {
    await sql`
      UPDATE jobs SET scheduled_at = ${scheduledAt}, updated_at = datetime('now')
      WHERE id = ${jobId} AND company_id = ${auth.companyId}
    `;
  }
  return NextResponse.json({ ok: true });
}
