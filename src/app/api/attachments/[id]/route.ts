import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT id FROM attachments WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`DELETE FROM attachments WHERE id = ${id} AND company_id = ${auth.companyId}`;
  // TODO(Phase 4 follow-up): also issue R2 DeleteObject via signed request.
  return NextResponse.json({ ok: true });
}
