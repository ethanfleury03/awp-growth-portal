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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const active = searchParams.get('active');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    let query = sql`
      SELECT
        p.*,
        COUNT(j.id) FILTER (WHERE date(j.scheduled_date) = date('now')) AS jobs_today,
        COUNT(j.id) FILTER (WHERE j.status = 'in_progress') AS jobs_in_progress,
        COUNT(j.id) FILTER (
          WHERE j.status = 'completed'
            AND datetime(j.completed_at) >= datetime('now', '-7 days')
        ) AS completed_this_week
      FROM plumbers p
      LEFT JOIN jobs j ON j.plumber_id = p.id
      WHERE 1=1
    `;

    if (search) {
      query = sql`${query} AND (
        p.name LIKE ${'%' + search + '%'}
        OR p.email LIKE ${'%' + search + '%'}
        OR p.phone LIKE ${'%' + search + '%'}
      )`;
    }

    if (active === 'true') {
      query = sql`${query} AND p.active = 1`;
    } else if (active === 'false') {
      query = sql`${query} AND p.active = 0`;
    }

    query = sql`
      ${query}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `;

    const plumbers = await query;
    return NextResponse.json({ plumbers });
  } catch (error: unknown) {
    console.error('Error fetching plumbers:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const companyId = await getOrCreateCompanyId(body.company_id);
    const result = await sql`
      INSERT INTO plumbers (company_id, name, email, phone, role, active, updated_at)
      VALUES (
        ${companyId},
        ${body.name},
        ${body.email},
        ${body.phone || null},
        ${body.role || 'Plumber'},
        ${body.active ?? true},
        datetime('now')
      )
      RETURNING *
    `;

    return NextResponse.json({ plumber: result[0] });
  } catch (error: unknown) {
    console.error('Error creating plumber:', error);
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
      UPDATE plumbers
      SET
        name = COALESCE(${updates.name ?? null}, name),
        email = COALESCE(${updates.email ?? null}, email),
        phone = COALESCE(${updates.phone ?? null}, phone),
        role = COALESCE(${updates.role ?? null}, role),
        active = COALESCE(${updates.active ?? null}, active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ plumber: result[0] });
  } catch (error: unknown) {
    console.error('Error updating plumber:', error);
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
    await sql`DELETE FROM plumbers WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting plumber:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
