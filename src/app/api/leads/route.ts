import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { ensureAwpDemoData } from '@/lib/awp/seed';
import { sourceToSlug } from '@/lib/awp/config';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const plumber_id = searchParams.get('plumber_id');
  const source = searchParams.get('source');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const search = searchParams.get('search');
  const excludeDemo = searchParams.get('exclude_demo') === 'true';

  const offset = (page - 1) * limit;

  try {
    await ensureAwpDemoData(portal.companyId, portal.branchId);

    let query = sql`
      SELECT 
        l.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.address as customer_address,
        p.name as plumber_name
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN plumbers p ON l.plumber_id = p.id
      WHERE l.company_id = ${portal.companyId}
    `;

    let countQuery = sql`
      SELECT COUNT(*) as total FROM leads l WHERE l.company_id = ${portal.companyId}
    `;

    if (status && status !== 'all') {
      query = sql`${query} AND l.status = ${status}`;
      countQuery = sql`${countQuery} AND l.status = ${status}`;
    }
    if (plumber_id && plumber_id !== 'all') {
      query = sql`${query} AND l.plumber_id = ${plumber_id}`;
      countQuery = sql`${countQuery} AND l.plumber_id = ${plumber_id}`;
    }
    if (source && source !== 'all') {
      query = sql`${query} AND l.source = ${source}`;
      countQuery = sql`${countQuery} AND l.source = ${source}`;
    }
    if (excludeDemo) {
      query = sql`${query} AND (l.lead_context_json IS NULL OR l.lead_context_json NOT LIKE '%"demoData":true%')`;
      countQuery = sql`${countQuery} AND (l.lead_context_json IS NULL OR l.lead_context_json NOT LIKE '%"demoData":true%')`;
    }
    if (search) {
      query = sql`${query} AND (c.name LIKE ${'%' + search + '%'} OR c.phone LIKE ${'%' + search + '%'} OR l.location LIKE ${'%' + search + '%'} OR l.issue LIKE ${'%' + search + '%'})`;
      countQuery = sql`${countQuery} AND (c.name LIKE ${'%' + search + '%'} OR c.phone LIKE ${'%' + search + '%'} OR l.location LIKE ${'%' + search + '%'} OR l.issue LIKE ${'%' + search + '%'})`;
    }

    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    query = sql`
      ${query} 
      ORDER BY l.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const leads = await query;

    return NextResponse.json({ leads, total });
  } catch (error: unknown) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const body = await request.json();

  try {
    const companyId = portal.companyId;

    let customerId = body.customer_id;
    if (customerId) {
      const exists = await sql`
        SELECT 1 FROM customers WHERE id = ${customerId} AND company_id = ${companyId} LIMIT 1
      `;
      if (exists.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
      }
    }

    if (!customerId && (body.customer_name || body.customer_phone)) {
      if (body.customer_phone) {
        const existingCustomer = await sql`
          SELECT id FROM customers
          WHERE phone = ${body.customer_phone} AND company_id = ${companyId}
          LIMIT 1
        `;
        if (existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
        }
      }

      if (!customerId) {
        const newCustomer = await sql`
          INSERT INTO customers (company_id, branch_id, name, phone, email, address)
          VALUES (
            ${companyId},
            ${portal.branchId || null},
            ${body.customer_name || 'Unknown'},
            ${body.customer_phone || ''},
            ${body.customer_email || null},
            ${body.customer_address || null}
          )
          RETURNING id
        `;
        customerId = newCustomer[0].id;
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
      INSERT INTO leads (
        company_id,
        branch_id,
        customer_id,
        plumber_id,
        source,
        status,
        priority,
        issue,
        description,
        location,
        ai_qualification,
        ai_score,
        lead_context_json,
        next_follow_up_at,
        last_contacted_at,
        estimated_value_cents
      )
      VALUES (
        ${companyId},
        ${portal.branchId || null},
        ${customerId || null},
        ${body.plumber_id || null},
        ${sourceToSlug(body.source || 'Website Form')},
        ${body.status || 'new_lead'},
        ${body.priority || 3},
        ${body.issue},
        ${body.description || null},
        ${body.location || null},
        ${body.ai_qualification || body.ai_summary || null},
        ${body.ai_score ?? null},
        ${body.lead_context_json || JSON.stringify(body.context || {})},
        ${body.next_follow_up_at || null},
        ${body.last_contacted_at || null},
        ${body.estimated_value_cents ?? null}
      )
      RETURNING *
    `;

    return NextResponse.json({ lead: result[0] });
  } catch (error: unknown) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const existing = await sql`
      SELECT company_id, customer_id FROM leads WHERE id = ${id} LIMIT 1
    `;
    if (existing.length === 0 || String((existing[0] as Record<string, unknown>).company_id) !== portal.companyId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let customerId = String((existing[0] as Record<string, unknown>).customer_id || '');
    if (updates.customer_name || updates.customer_phone || updates.customer_email || updates.customer_address) {
      if (customerId) {
        await sql`
          UPDATE customers
          SET
            name = COALESCE(${updates.customer_name ?? null}, name),
            phone = COALESCE(${updates.customer_phone ?? null}, phone),
            email = COALESCE(${updates.customer_email ?? null}, email),
            address = COALESCE(${updates.customer_address ?? null}, address),
            updated_at = datetime('now')
          WHERE id = ${customerId} AND company_id = ${portal.companyId}
        `;
      } else {
        const customer = await sql`
          INSERT INTO customers (company_id, branch_id, name, phone, email, address)
          VALUES (
            ${portal.companyId},
            ${portal.branchId || null},
            ${updates.customer_name || 'Unknown'},
            ${updates.customer_phone || ''},
            ${updates.customer_email || null},
            ${updates.customer_address || null}
          )
          RETURNING id
        `;
        customerId = String(customer[0].id);
      }
    }

    const result = await sql`
      UPDATE leads
      SET
        customer_id = COALESCE(${customerId || null}, customer_id),
        plumber_id = COALESCE(${updates.plumber_id ?? null}, plumber_id),
        source = COALESCE(${updates.source !== undefined ? sourceToSlug(updates.source) : null}, source),
        status = COALESCE(${updates.status ?? null}, status),
        priority = COALESCE(${updates.priority ?? null}, priority),
        issue = COALESCE(${updates.issue ?? null}, issue),
        description = COALESCE(${updates.description ?? null}, description),
        location = COALESCE(${updates.location ?? null}, location),
        ai_qualification = COALESCE(${updates.ai_qualification ?? updates.ai_summary ?? null}, ai_qualification),
        ai_score = COALESCE(${updates.ai_score ?? null}, ai_score),
        lead_context_json = COALESCE(${updates.lead_context_json || (updates.context ? JSON.stringify(updates.context) : null)}, lead_context_json),
        next_follow_up_at = COALESCE(${updates.next_follow_up_at ?? null}, next_follow_up_at),
        last_contacted_at = COALESCE(${updates.last_contacted_at ?? null}, last_contacted_at),
        estimated_value_cents = COALESCE(${updates.estimated_value_cents ?? null}, estimated_value_cents),
        updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING *
    `;

    return NextResponse.json({ lead: result[0] });
  } catch (error: unknown) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM leads WHERE id = ${id} AND company_id = ${portal.companyId}`;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
