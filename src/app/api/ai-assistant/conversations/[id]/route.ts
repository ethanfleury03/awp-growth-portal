import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { sql } from '@/lib/db';
import { parseJsonSafely } from '@/lib/ops';

function normalizeMessage(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    role: String(row.role),
    content: String(row.content || ''),
    model: String(row.model || ''),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    contextSnapshot: parseJsonSafely<Record<string, unknown>>(String(row.context_snapshot_json || '')) || null,
    createdAt: row.created_at,
  };
}

function normalizeDraft(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    actionType: String(row.action_type || ''),
    title: String(row.title || ''),
    payload: parseJsonSafely<Record<string, unknown>>(String(row.payload_json || '')) || {},
    status: String(row.status || 'Draft'),
    relatedRecordType: row.related_record_type,
    relatedRecordId: row.related_record_id,
    createdAt: row.created_at,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const conversations = await sql`
    SELECT id, title, selected_model, status, created_at, updated_at
    FROM ai_conversations
    WHERE id = ${id} AND company_id = ${auth.companyId}
    LIMIT 1
  `;
  if (!conversations.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [messages, drafts] = await Promise.all([
    sql`
      SELECT *
      FROM ai_messages
      WHERE conversation_id = ${id} AND company_id = ${auth.companyId}
      ORDER BY created_at ASC
    `,
    sql`
      SELECT *
      FROM ai_action_drafts
      WHERE conversation_id = ${id} AND company_id = ${auth.companyId}
      ORDER BY created_at DESC
    `,
  ]);

  return NextResponse.json({
    conversation: {
      id: String(conversations[0].id),
      title: String(conversations[0].title || ''),
      selectedModel: String(conversations[0].selected_model || ''),
      status: String(conversations[0].status || ''),
      createdAt: conversations[0].created_at,
      updatedAt: conversations[0].updated_at,
    },
    messages: messages.map(normalizeMessage),
    actionDrafts: drafts.map(normalizeDraft),
  });
}
