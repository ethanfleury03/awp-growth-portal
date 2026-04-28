import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond('staff');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const rows = await sql`
    SELECT id FROM service_contracts WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (typeof body?.active === 'boolean') {
    await sql`
      UPDATE service_contracts SET active = ${body.active ? 1 : 0}, updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;
  }
  if (typeof body?.nextDueAt === 'string' || body?.nextDueAt === null) {
    await sql`
      UPDATE service_contracts SET next_due_at = ${body.nextDueAt || null}, updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  await sql`
    DELETE FROM service_contracts WHERE id = ${id} AND company_id = ${auth.companyId}
  `;
  return NextResponse.json({ ok: true });
}
