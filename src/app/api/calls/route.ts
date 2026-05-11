import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

function parseDurationToSeconds(duration: unknown) {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return duration;
  }

  if (typeof duration !== 'string') {
    return 0;
  }

  const parts = duration.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

async function assertLinkedRecordsBelongToCompany(
  companyId: string,
  links: { customer_id?: unknown; lead_id?: unknown; job_id?: unknown },
) {
  const customerId = typeof links.customer_id === 'string' ? links.customer_id.trim() : '';
  if (customerId) {
    const rows = await sql`SELECT id FROM customers WHERE id = ${customerId} AND company_id = ${companyId} LIMIT 1`;
    if (!rows.length) throw new Error('Customer not found');
  }

  const leadId = typeof links.lead_id === 'string' ? links.lead_id.trim() : '';
  if (leadId) {
    const rows = await sql`SELECT id FROM leads WHERE id = ${leadId} AND company_id = ${companyId} LIMIT 1`;
    if (!rows.length) throw new Error('Lead not found');
  }

  const jobId = typeof links.job_id === 'string' ? links.job_id.trim() : '';
  if (jobId) {
    const rows = await sql`SELECT id FROM jobs WHERE id = ${jobId} AND company_id = ${companyId} LIMIT 1`;
    if (!rows.length) throw new Error('Job not found');
  }
}

export async function GET(request: Request) {
  const auth = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));

  try {
    let query = sql`
      SELECT *
      FROM call_logs
      WHERE company_id = ${auth.companyId}
    `;

    if (search) {
      query = sql`${query} AND (
        customer_name ILIKE ${'%' + search + '%'}
        OR phone_number ILIKE ${'%' + search + '%'}
        OR COALESCE(ai_summary, '') ILIKE ${'%' + search + '%'}
      )`;
    }

    if (status && status !== 'all') {
      query = sql`${query} AND status = ${status}`;
    }

    query = sql`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const calls = await query;
    return NextResponse.json({ calls });
  } catch (error: unknown) {
    console.error('Error fetching calls:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();

  try {
    await assertLinkedRecordsBelongToCompany(auth.companyId, body);
    const result = await sql`
      INSERT INTO call_logs (
        company_id,
        customer_id,
        lead_id,
        job_id,
        customer_name,
        phone_number,
        duration_seconds,
        status,
        transcript,
        ai_summary,
        outcome,
        recording,
        created_at,
        updated_at
      )
      VALUES (
        ${auth.companyId},
        ${body.customer_id || null},
        ${body.lead_id || null},
        ${body.job_id || null},
        ${body.customer_name || null},
        ${body.phone_number},
        ${parseDurationToSeconds(body.duration_seconds ?? body.duration)},
        ${body.status || 'completed'},
        ${body.transcript || null},
        ${body.ai_summary || null},
        ${body.outcome || null},
        ${body.recording ?? false},
        COALESCE(${body.created_at || null}, NOW()),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ call: result[0] });
  } catch (error: unknown) {
    console.error('Error creating call log:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await assertLinkedRecordsBelongToCompany(auth.companyId, updates);
    const result = await sql`
      UPDATE call_logs
      SET
        customer_name = COALESCE(${updates.customer_name ?? null}, customer_name),
        phone_number = COALESCE(${updates.phone_number ?? null}, phone_number),
        status = COALESCE(${updates.status ?? null}, status),
        transcript = COALESCE(${updates.transcript ?? null}, transcript),
        ai_summary = COALESCE(${updates.ai_summary ?? null}, ai_summary),
        outcome = COALESCE(${updates.outcome ?? null}, outcome),
        recording = COALESCE(${updates.recording ?? null}, recording),
        duration_seconds = COALESCE(${updates.duration_seconds ?? null}, duration_seconds),
        lead_id = COALESCE(${updates.lead_id ?? null}, lead_id),
        job_id = COALESCE(${updates.job_id ?? null}, job_id),
        customer_id = COALESCE(${updates.customer_id ?? null}, customer_id),
        updated_at = NOW()
      WHERE id = ${id} AND company_id = ${auth.companyId}
      RETURNING *
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ call: result[0] });
  } catch (error: unknown) {
    console.error('Error updating call log:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM call_logs WHERE id = ${id} AND company_id = ${auth.companyId}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting call log:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
