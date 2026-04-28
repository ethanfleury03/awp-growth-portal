import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { publicUrlFor, r2ConfigFromEnv } from '@/lib/attachments/r2';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType + entityId required' }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, file_key, file_name, mime_type, size_bytes, uploaded_by_user_id, created_at
    FROM attachments
    WHERE company_id = ${auth.companyId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
    ORDER BY datetime(created_at) DESC
  `;

  const config = r2ConfigFromEnv();
  const enriched = rows.map((r) => ({
    ...r,
    publicUrl: config ? publicUrlFor(config, String((r as Record<string, unknown>).file_key)) : null,
  }));

  return NextResponse.json({ attachments: enriched });
}
