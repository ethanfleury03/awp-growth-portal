import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

async function getOrCreateCompanyId(explicitCompanyId?: string | null) {
  if (explicitCompanyId) {
    return explicitCompanyId;
  }

  const companies = await sql`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`;
  if (companies.length > 0) {
    return companies[0].id as string;
  }

  const newCompany = await sql`
    INSERT INTO companies (name, email)
    VALUES ('Demo Company', 'demo@plumberos.com')
    RETURNING id
  `;

  return newCompany[0].id as string;
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    let query = sql`
      SELECT *
      FROM call_logs
      WHERE 1=1
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
  const body = await request.json();

  try {
    const companyId = await getOrCreateCompanyId(body.company_id);
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
        ${companyId},
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
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
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
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ call: result[0] });
  } catch (error: unknown) {
    console.error('Error updating call log:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM call_logs WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting call log:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
