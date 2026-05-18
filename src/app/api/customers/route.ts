import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { normalizeCustomerPayload } from '@/lib/customers/validation';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

// GET - Fetch customers
export async function GET(request: Request) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search');

  const offset = (page - 1) * limit;

  try {
    let query = sql`
      SELECT 
        c.*,
        COUNT(j.id) as total_jobs,
        COALESCE(SUM(j.final_price), 0) as total_spent,
        MAX(j.created_at) as last_job_date
      FROM customers c
      LEFT JOIN jobs j ON c.id = j.customer_id
      WHERE c.company_id = ${portal.companyId}
    `;
    
    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM customers c
      WHERE c.company_id = ${portal.companyId}
    `;
    
    if (search) {
      query = sql`${query} AND (c.name ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.address ILIKE ${'%' + search + '%'})`;
      countQuery = sql`${countQuery} AND (c.name ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.address ILIKE ${'%' + search + '%'})`;
    }

    query = sql`${query} GROUP BY c.id`;

    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    query = sql`
      ${query} 
      ORDER BY c.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const customers = await query;

    return NextResponse.json({ customers, total });
  } catch (error: unknown) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// POST - Create customer
export async function POST(request: Request) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const parsed = normalizeCustomerPayload(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const customer = parsed.value;
  
  try {
    const result = await sql`
      INSERT INTO customers (company_id, name, email, phone, address, notes)
      VALUES (
        ${portal.companyId},
        ${customer.name},
        ${customer.email},
        ${customer.phone},
        ${customer.address},
        ${customer.notes}
      )
      RETURNING *
    `;

    return NextResponse.json({ customer: result[0] }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// PUT - Update customer
export async function PUT(request: Request) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const body = await request.json();
  const { id, ...updates } = body;
  const parsed = normalizeCustomerPayload(updates);

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const customer = parsed.value;

  try {
    const existing = await sql`
      SELECT id FROM customers
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const result = await sql`
      UPDATE customers 
      SET name = ${customer.name},
          email = ${customer.email},
          phone = ${customer.phone},
          address = ${customer.address},
          notes = ${customer.notes},
          updated_at = NOW()
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING *
    `;

    return NextResponse.json({ customer: result[0] });
  } catch (error: unknown) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// DELETE - Delete customer
export async function DELETE(request: Request) {
  const portal = await requireModuleOrRespond('customers');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const existing = await sql`
      SELECT id FROM customers
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const deletedLeads = await sql`
      DELETE FROM leads
      WHERE customer_id = ${id} AND company_id = ${portal.companyId}
      RETURNING id
    `;

    await sql`DELETE FROM customers WHERE id = ${id} AND company_id = ${portal.companyId}`;

    return NextResponse.json({ success: true, deletedLeads: deletedLeads.length });
  } catch (error: unknown) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
