import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const active = searchParams.get('active');
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));

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
      LEFT JOIN jobs j ON j.plumber_id = p.id AND j.company_id = ${auth.companyId}
      WHERE p.company_id = ${auth.companyId}
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
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json();

  try {
    const result = await sql`
      INSERT INTO plumbers (company_id, name, email, phone, role, active, updated_at)
      VALUES (
        ${auth.companyId},
        ${body.name},
        ${body.email},
        ${body.phone || null},
        ${body.role || 'Team Member'},
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
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

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
      WHERE id = ${id} AND company_id = ${auth.companyId}
      RETURNING *
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ plumber: result[0] });
  } catch (error: unknown) {
    console.error('Error updating plumber:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM plumbers WHERE id = ${id} AND company_id = ${auth.companyId}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting plumber:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
