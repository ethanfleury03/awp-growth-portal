import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requirePortalUser } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const plumber_id = searchParams.get('plumber_id');
  const customer_id = searchParams.get('customer_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search');

  const offset = (page - 1) * limit;

  try {
    let query = sql`
      SELECT 
        j.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        p.name as plumber_name,
        l.issue as lead_issue
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN plumbers p ON j.plumber_id = p.id
      LEFT JOIN leads l ON j.lead_id = l.id
      WHERE j.company_id = ${portal.companyId}
    `;

    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM jobs j
      WHERE j.company_id = ${portal.companyId}
    `;

    if (status && status !== 'all') {
      query = sql`${query} AND j.status = ${status}`;
      countQuery = sql`${countQuery} AND j.status = ${status}`;
    }
    if (plumber_id && plumber_id !== 'all') {
      query = sql`${query} AND j.plumber_id = ${plumber_id}`;
      countQuery = sql`${countQuery} AND j.plumber_id = ${plumber_id}`;
    }
    if (customer_id && customer_id !== 'all') {
      query = sql`${query} AND j.customer_id = ${customer_id}`;
      countQuery = sql`${countQuery} AND j.customer_id = ${customer_id}`;
    }
    if (search) {
      query = sql`${query} AND (c.name LIKE ${'%' + search + '%'} OR j.type LIKE ${'%' + search + '%'} OR j.description LIKE ${'%' + search + '%'})`;
      countQuery = sql`${countQuery} AND (c.name LIKE ${'%' + search + '%'} OR j.type LIKE ${'%' + search + '%'} OR j.description LIKE ${'%' + search + '%'})`;
    }

    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    query = sql`
      ${query} 
      ORDER BY j.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const jobs = await query;

    return NextResponse.json({ jobs, total });
  } catch (error: unknown) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const companyId = portal.companyId;

    if (body.customer_id) {
      const exists = await sql`
        SELECT 1 FROM customers WHERE id = ${body.customer_id} AND company_id = ${companyId} LIMIT 1
      `;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
      }
    }
    if (body.lead_id) {
      const exists = await sql`
        SELECT 1 FROM leads WHERE id = ${body.lead_id} AND company_id = ${companyId} LIMIT 1
      `;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 400 });
      }
    }
    if (body.plumber_id) {
      const exists = await sql`
        SELECT 1 FROM plumbers WHERE id = ${body.plumber_id} AND company_id = ${companyId} LIMIT 1
      `;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'Plumber not found' }, { status: 400 });
      }
    }

    const result = await sql`
      INSERT INTO jobs (company_id, lead_id, customer_id, plumber_id, status, type, description, scheduled_date, scheduled_time, estimated_price, notes, source_estimate_id)
      VALUES (
        ${companyId},
        ${body.lead_id || null},
        ${body.customer_id || null},
        ${body.plumber_id || null},
        ${body.status || 'scheduled'},
        ${body.type},
        ${body.description || null},
        ${body.scheduled_date || null},
        ${body.scheduled_time || null},
        ${body.estimated_price || null},
        ${body.notes || null},
        ${body.source_estimate_id || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ job: result[0] });
  } catch (error: unknown) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const existing = await sql`
      SELECT company_id FROM jobs WHERE id = ${id} LIMIT 1
    `;
    if (existing.length === 0 || String((existing[0] as Record<string, unknown>).company_id) !== portal.companyId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // COALESCE-style partial update: only explicitly-provided fields change.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(updates, k);
    const fields: Record<string, unknown> = {};
    for (const k of [
      'status',
      'plumber_id',
      'description',
      'scheduled_date',
      'scheduled_time',
      'scheduled_at',
      'estimated_price',
      'final_price',
      'notes',
    ]) {
      if (has(k)) fields[k] = updates[k];
    }
    if (has('status') && updates.status === 'in_progress') {
      fields['started_at'] = new Date().toISOString();
    }
    if (has('status') && updates.status === 'completed') {
      fields['completed_at'] = new Date().toISOString();
    }

    // No-op if nothing changed.
    if (Object.keys(fields).length === 0) {
      const row = await sql`SELECT * FROM jobs WHERE id = ${id} LIMIT 1`;
      return NextResponse.json({ job: row[0] });
    }

    // Per-field update with an explicit whitelist (no dynamic identifier
    // interpolation; each column has its own static template).
    for (const [col, val] of Object.entries(fields)) {
      switch (col) {
        case 'status':
          await sql`UPDATE jobs SET status = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'plumber_id':
          await sql`UPDATE jobs SET plumber_id = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'description':
          await sql`UPDATE jobs SET description = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'scheduled_date':
          await sql`UPDATE jobs SET scheduled_date = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'scheduled_time':
          await sql`UPDATE jobs SET scheduled_time = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'scheduled_at':
          await sql`UPDATE jobs SET scheduled_at = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'estimated_price':
          await sql`UPDATE jobs SET estimated_price = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'final_price':
          await sql`UPDATE jobs SET final_price = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'notes':
          await sql`UPDATE jobs SET notes = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'started_at':
          await sql`UPDATE jobs SET started_at = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
        case 'completed_at':
          await sql`UPDATE jobs SET completed_at = ${val}, updated_at = datetime('now') WHERE id = ${id} AND company_id = ${portal.companyId}`;
          break;
      }
    }

    const result = await sql`SELECT * FROM jobs WHERE id = ${id} LIMIT 1`;
    return NextResponse.json({ job: result[0] });
  } catch (error: unknown) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM jobs WHERE id = ${id} AND company_id = ${portal.companyId}`;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting job:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
