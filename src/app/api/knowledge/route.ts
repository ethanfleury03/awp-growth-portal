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
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function parseJsonArray(value: unknown) {
  const parsed = parseJsonSafely<unknown[]>(typeof value === 'string' ? value : '');
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function normalizeRow(row: Record<string, unknown>) {
  return {
    ...row,
    tags: parseJsonArray(row.tags_json),
    sourceMetadata: parseJsonSafely<Record<string, unknown>>(String(row.source_metadata_json || '')) || {},
    is_pinned: Boolean(row.is_pinned),
  };
}

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const needle = `%${q}%`;

  let query = sql`
    SELECT *
    FROM knowledge_items
    WHERE company_id = ${auth.companyId}
  `;

  if (type && type !== 'all') {
    query = sql`${query} AND item_type = ${type}`;
  }
  if (status && status !== 'all') {
    query = sql`${query} AND status = ${status}`;
  } else {
    query = sql`${query} AND status != 'Archived'`;
  }
  if (q) {
    query = sql`${query} AND (title LIKE ${needle} OR body LIKE ${needle} OR url LIKE ${needle} OR tags_json LIKE ${needle})`;
  }

  const rows = await sql`
    ${query}
    ORDER BY is_pinned DESC, updated_at DESC, title ASC
    LIMIT 200
  `;

  return NextResponse.json({ items: rows.map(normalizeRow), types: [...KB_TYPES], statuses: [...STATUSES] });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const body = await request.json();

  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const itemType = KB_TYPES.has(body.itemType) ? body.itemType : 'Other';
  const status = STATUSES.has(body.status) ? body.status : 'Active';
  const tags = normalizeTags(body.tags);

  const result = await sql`
    INSERT INTO knowledge_items (
      company_id,
      title,
      item_type,
      status,
      body,
      url,
      tags_json,
      source_metadata_json,
      is_pinned,
      created_by_user_id
    ) VALUES (
      ${auth.companyId},
      ${title},
      ${itemType},
      ${status},
      ${body.body || null},
      ${body.url || null},
      ${JSON.stringify(tags)},
      ${JSON.stringify(body.sourceMetadata || {})},
      ${Boolean(body.isPinned)},
      ${auth.id}
    )
    RETURNING *
  `;

  return NextResponse.json({ item: normalizeRow(result[0]) });
}
