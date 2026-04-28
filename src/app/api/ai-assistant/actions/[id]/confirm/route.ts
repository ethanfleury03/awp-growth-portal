import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { sql } from '@/lib/db';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const existing = await sql`
    SELECT id, status
    FROM ai_action_drafts
    WHERE id = ${id} AND company_id = ${auth.companyId}
    LIMIT 1
  `;
  if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`
    UPDATE ai_action_drafts
    SET status = 'Confirmed', updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${auth.companyId}
  `;

  return NextResponse.json({
    ok: true,
    message: 'Draft marked confirmed. Applying draft actions to portal records is intentionally deferred.',
  });
}
