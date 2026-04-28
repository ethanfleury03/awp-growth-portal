import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { parseJsonSafely } from '@/lib/ops';

const KB_TYPES = new Set([
  'Company Facts',
  'Services',
  'Sales Rules',
  'FAQs',
  'Website Notes',
  'Marketing Voice',
  'Images/Files',
  'Do Not Say',
  'Pricing/Warranty Guardrails',
  'Other',
]);

const STATUSES = new Set(['Active', 'Draft', 'Archived']);

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function normalizeRow(row: Record<string, unknown>) {
  const tags = parseJsonSafely<unknown[]>(String(row.tags_json || ''));
  return {
    ...row,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    sourceMetadata: parseJsonSafely<Record<string, unknown>>(String(row.source_metadata_json || '')) || {},
    is_pinned: Boolean(row.is_pinned),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT *
    FROM knowledge_items
    WHERE id = ${id} AND company_id = ${auth.companyId}
    LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item: normalizeRow(rows[0]) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  const existing = await sql`
    SELECT id FROM knowledge_items WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const itemType = body.itemType && KB_TYPES.has(body.itemType) ? body.itemType : null;
  const status = body.status && STATUSES.has(body.status) ? body.status : null;
  const tags = body.tags !== undefined ? JSON.stringify(normalizeTags(body.tags)) : null;

  const result = await sql`
    UPDATE knowledge_items
    SET
      title = COALESCE(${body.title || null}, title),
      item_type = COALESCE(${itemType}, item_type),
      status = COALESCE(${status}, status),
      body = ${body.body ?? null},
      url = ${body.url ?? null},
      tags_json = COALESCE(${tags}, tags_json),
      source_metadata_json = ${JSON.stringify(body.sourceMetadata || {})},
      is_pinned = ${Boolean(body.isPinned)},
      updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${auth.companyId}
    RETURNING *
  `;

  return NextResponse.json({ item: normalizeRow(result[0]) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  await sql`DELETE FROM knowledge_items WHERE id = ${id} AND company_id = ${auth.companyId}`;
  return NextResponse.json({ ok: true });
}
