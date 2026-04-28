import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { sql } from '@/lib/db';

function normalize(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title || 'New conversation'),
    selectedModel: String(row.selected_model || ''),
    status: String(row.status || 'Active'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const rows = await sql`
    SELECT id, title, selected_model, status, created_at, updated_at
    FROM ai_conversations
    WHERE company_id = ${auth.companyId}
    ORDER BY updated_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ conversations: rows.map(normalize) });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const body = await request.json().catch(() => ({}));

  const result = await sql`
    INSERT INTO ai_conversations (company_id, title, selected_model, created_by_user_id)
    VALUES (
      ${auth.companyId},
      ${body.title || 'New conversation'},
      ${body.selectedModel || null},
      ${auth.id}
    )
    RETURNING id, title, selected_model, status, created_at, updated_at
  `;

  return NextResponse.json({ conversation: normalize(result[0]) });
}
