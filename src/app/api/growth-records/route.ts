import { NextResponse } from 'next/server';
import { ensureAwpDemoData } from '@/lib/awp/seed';
import type { GrowthRecordType } from '@/lib/awp/config';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

const allowedTypes = new Set<GrowthRecordType>([
  'campaign',
  'lead_list',
  'asset',
  'seo_task',
  'project',
  'ai_prompt_template',
]);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return {};
  return payload as Record<string, unknown>;
}

function parsePayloadJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeRecord(row: Record<string, unknown>) {
  return {
    ...row,
    payload: parsePayloadJson(row.payload_json),
    is_demo: Boolean(row.is_demo),
  };
}

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') as GrowthRecordType | null;

  if (type && !allowedTypes.has(type)) {
    return NextResponse.json({ error: 'Unsupported record type' }, { status: 400 });
  }

  try {
    await ensureAwpDemoData(auth.companyId, auth.branchId);

    const rows = type
      ? await sql`
          SELECT *
          FROM growth_records
          WHERE company_id = ${auth.companyId} AND record_type = ${type}
          ORDER BY sort_order ASC, updated_at DESC, title ASC
        `
      : await sql`
          SELECT *
          FROM growth_records
          WHERE company_id = ${auth.companyId}
          ORDER BY record_type ASC, sort_order ASC, updated_at DESC, title ASC
        `;

    return NextResponse.json({ records: rows.map(normalizeRecord) });
  } catch (error: unknown) {
    console.error('Error fetching growth records:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();
  const recordType = body.record_type as GrowthRecordType;

  if (!allowedTypes.has(recordType)) {
    return NextResponse.json({ error: 'Unsupported record type' }, { status: 400 });
  }
  if (!body.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const result = await sql`
      INSERT INTO growth_records (
        company_id,
        record_type,
        title,
        status,
        owner,
        related_record_id,
        payload_json,
        is_demo,
        sort_order
      )
      VALUES (
        ${auth.companyId},
        ${recordType},
        ${body.title},
        ${body.status || 'Idea'},
        ${body.owner || null},
        ${body.related_record_id || null},
        ${JSON.stringify(normalizePayload(body.payload))},
        ${false},
        ${Number(body.sort_order || 0)}
      )
      RETURNING *
    `;

    return NextResponse.json({ record: normalizeRecord(result[0]) });
  } catch (error: unknown) {
    console.error('Error creating growth record:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const existing = await sql`
      SELECT id FROM growth_records
      WHERE id = ${body.id} AND company_id = ${auth.companyId}
      LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await sql`
      UPDATE growth_records
      SET
        title = COALESCE(${body.title || null}, title),
        status = COALESCE(${body.status || null}, status),
        owner = ${body.owner ?? null},
        related_record_id = ${body.related_record_id ?? null},
        payload_json = ${JSON.stringify(normalizePayload(body.payload))},
        updated_at = datetime('now')
      WHERE id = ${body.id} AND company_id = ${auth.companyId}
      RETURNING *
    `;

    return NextResponse.json({ record: normalizeRecord(result[0]) });
  } catch (error: unknown) {
    console.error('Error updating growth record:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await sql`
      DELETE FROM growth_records
      WHERE id = ${id} AND company_id = ${auth.companyId}
    `;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting growth record:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
