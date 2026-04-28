import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '100'), 1), 500);
  const action = url.searchParams.get('action');
  const entityType = url.searchParams.get('entity_type');

  if (action && entityType) {
    const rows = await sql`
      SELECT id, action, entity_type, entity_id, summary, metadata,
             actor_user_id, actor_email, actor_role, ip_address, created_at
      FROM audit_events
      WHERE company_id = ${auth.companyId}
        AND action = ${action}
        AND entity_type = ${entityType}
      ORDER BY datetime(created_at) DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ events: rows });
  }
  if (action) {
    const rows = await sql`
      SELECT id, action, entity_type, entity_id, summary, metadata,
             actor_user_id, actor_email, actor_role, ip_address, created_at
      FROM audit_events
      WHERE company_id = ${auth.companyId} AND action = ${action}
      ORDER BY datetime(created_at) DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ events: rows });
  }
  if (entityType) {
    const rows = await sql`
      SELECT id, action, entity_type, entity_id, summary, metadata,
             actor_user_id, actor_email, actor_role, ip_address, created_at
      FROM audit_events
      WHERE company_id = ${auth.companyId} AND entity_type = ${entityType}
      ORDER BY datetime(created_at) DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ events: rows });
  }

  const rows = await sql`
    SELECT id, action, entity_type, entity_id, summary, metadata,
           actor_user_id, actor_email, actor_role, ip_address, created_at
    FROM audit_events
    WHERE company_id = ${auth.companyId}
    ORDER BY datetime(created_at) DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ events: rows });
}
