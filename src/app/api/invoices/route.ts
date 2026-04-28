import { randomBytes } from 'crypto';
import { getDb, sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  deleteInvoiceLineItems,
  groupLineItemsByInvoiceId,
  insertInvoiceLineItems,
  listLineItemsForInvoiceIds,
} from '@/lib/invoices/invoice-line-items';
import { requirePortalUser } from '@/lib/auth/tenant';
import { allocateInvoiceNumber } from '@/lib/invoices/number';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

const toMoney = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const todayIsoDate = () => new Date().toISOString().split('T')[0];

function mapInvoiceRow(row: Record<string, unknown>) {
  const cust_name = row.cust_name;
  const cust_email = row.cust_email;
  const cust_phone = row.cust_phone;
  const inv = { ...row };
  delete inv.cust_name;
  delete inv.cust_email;
  delete inv.cust_phone;
  const customerId = inv.customer_id;
  const customers =
    customerId &&
    (cust_name != null || cust_email != null || cust_phone != null)
      ? {
          name: cust_name as string | null | undefined,
          email: cust_email as string | null | undefined,
          phone: cust_phone as string | null | undefined,
        }
      : null;
  return { ...inv, customers };
}

async function loadJobForCompany(companyId: string, jobId: string) {
  const rows = await sql`
    SELECT id, company_id, customer_id, type, description, estimated_price, final_price
    FROM jobs
    WHERE id = ${jobId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

async function loadLeadForCompany(companyId: string, leadId: string) {
  const rows = await sql`
    SELECT id, company_id, customer_id, issue, description
    FROM leads
    WHERE id = ${leadId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

async function customerExistsInCompany(companyId: string, customerId: string) {
  const rows = await sql`
    SELECT 1
    FROM customers
    WHERE id = ${customerId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function GET(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const customer_id = searchParams.get('customer_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM invoices i
      WHERE i.company_id = ${portal.companyId}
    `;
    let dataQuery = sql`
      SELECT
        i.*,
        c.name AS cust_name,
        c.email AS cust_email,
        c.phone AS cust_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.company_id = ${portal.companyId}
    `;

    if (status && status !== 'all') {
      countQuery = sql`${countQuery} AND i.status = ${status}`;
      dataQuery = sql`${dataQuery} AND i.status = ${status}`;
    }
    if (customer_id && customer_id !== 'all') {
      countQuery = sql`${countQuery} AND i.customer_id = ${customer_id}`;
      dataQuery = sql`${dataQuery} AND i.customer_id = ${customer_id}`;
    }

    const countResult = await countQuery;
    const total = Number(countResult[0]?.total || 0);

    dataQuery = sql`
      ${dataQuery}
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await dataQuery;
    const invIds = rows.map((r) => String((r as Record<string, unknown>).id));
    const invoices = rows.map(mapInvoiceRow);
    const lineRows = listLineItemsForInvoiceIds(invIds);
    const byInvoice = groupLineItemsByInvoiceId(lineRows);

    return NextResponse.json({
      invoices: invoices.map((inv, i) => ({
        ...inv,
        line_items: byInvoice.get(invIds[i]) ?? [],
      })),
      total,
    });
  } catch (error: unknown) {
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
    let customerId = body.customer_id || null;
    const jobId = body.job_id || null;
    let serviceType = body.service_type || null;
    let notes = body.notes || null;
    let amount = toMoney(body.amount);
    const companyId = portal.companyId;

    if (jobId) {
      const job = await loadJobForCompany(companyId, String(jobId));
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 400 });
      }
      customerId = customerId || (job.customer_id as string | null);
      serviceType = serviceType || (job.type as string);
      notes = notes || (job.description as string | null) || null;
      amount =
        amount ||
        toMoney(job.final_price, toMoney(job.estimated_price));
    }

    if (body.lead_id) {
      const lead = await loadLeadForCompany(companyId, String(body.lead_id));
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 400 });
      }
      customerId = customerId || (lead.customer_id as string | null);
      serviceType = serviceType || (lead.issue as string);
      notes = notes || (lead.description as string | null) || null;
    }

    if (customerId && !(await customerExistsInCompany(companyId, String(customerId)))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
    }

    type LineIn = {
      name?: string;
      description?: string | null;
      quantity?: number;
      unit_price_cents?: number;
      catalog_service_id?: string | null;
    };
    const rawLines = Array.isArray(body.line_items) ? (body.line_items as LineIn[]) : [];
    const useLines = rawLines.length > 0;

    if (!customerId && body.customer_name && companyId) {
      let existing: Record<string, unknown>[] = [];
      if (body.customer_phone) {
        existing = await sql`
          SELECT id FROM customers
          WHERE company_id = ${companyId} AND phone = ${body.customer_phone}
          LIMIT 1
        `;
      }

      if (existing.length > 0) {
        customerId = existing[0].id as string;
      } else {
        const created = await sql`
          INSERT INTO customers (company_id, name, phone, email, address)
          VALUES (
            ${companyId},
            ${body.customer_name},
            ${body.customer_phone || 'Unknown'},
            ${body.customer_email || null},
            ${body.customer_address || null}
          )
          RETURNING id
        `;
        customerId = created[0].id as string;
      }
    }

    let tax = toMoney(body.tax);
    let total = toMoney(body.total);
    let amountCents: number;
    let taxCents: number;
    let totalCents: number;
    const normalizedLines: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unit_price_cents: number;
      catalog_service_id: string | null;
    }> = [];

    if (useLines) {
      for (const line of rawLines) {
        const name = String(line.name || '').trim();
        const unit = Math.max(0, Math.round(Number(line.unit_price_cents) || 0));
        const qty = Math.max(0.0001, Number(line.quantity) || 1);
        if (!name || unit <= 0) {
          return NextResponse.json({ error: 'Each line needs a name and a unit price greater than zero.' }, { status: 400 });
        }
        normalizedLines.push({
          name,
          description: line.description != null ? String(line.description).trim() || null : null,
          quantity: qty,
          unit_price_cents: unit,
          catalog_service_id: line.catalog_service_id ? String(line.catalog_service_id) : null,
        });
      }
      const subtotalCents = normalizedLines.reduce(
        (s, it) => s + Math.round(it.quantity * it.unit_price_cents),
        0,
      );
      if (subtotalCents <= 0) {
        return NextResponse.json({ error: 'Invoice subtotal must be greater than zero.' }, { status: 400 });
      }
      tax = toMoney(body.tax);
      taxCents = Math.round(tax * 100);
      totalCents = subtotalCents + taxCents;
      amountCents = subtotalCents;
      const subtotalDollars = subtotalCents / 100;
      total = totalCents / 100;
      amount = subtotalDollars;
      if (normalizedLines.length === 1) {
        serviceType = normalizedLines[0].name;
      } else {
        serviceType = `Multiple services (${normalizedLines.length})`;
      }
    } else {
      total = toMoney(body.total, amount + tax);
      amountCents = Math.round(amount * 100);
      taxCents = Math.round(tax * 100);
      totalCents = Math.round(total * 100);
    }

    const publicPayToken = randomBytes(24).toString('hex');
    const issueDate = body.issue_date || body.date || todayIsoDate();
    const dueDate = body.due_date || null;
    const paidDate = body.status === 'paid' ? body.paid_date || todayIsoDate() : null;

    const invoiceNumber = allocateInvoiceNumber(getDb(), companyId);

    const inserted = await sql`
      INSERT INTO invoices (
        company_id, customer_id, job_id, invoice_number, service_type,
        status, amount, tax, total, amount_cents, tax_cents, total_cents, public_pay_token,
        issue_date, due_date, paid_date, notes
      )
      VALUES (
        ${companyId},
        ${customerId},
        ${jobId},
        ${invoiceNumber},
        ${serviceType},
        ${body.status || 'pending'},
        ${amount},
        ${tax},
        ${total},
        ${amountCents},
        ${taxCents},
        ${totalCents},
        ${publicPayToken},
        ${issueDate},
        ${dueDate},
        ${paidDate},
        ${notes}
      )
      RETURNING id
    `;

    const invoiceId = String((inserted[0] as { id: string }).id);

    if (useLines && normalizedLines.length > 0) {
      await insertInvoiceLineItems(invoiceId, normalizedLines);
    }

    const fullRows = await sql`
      SELECT
        i.*,
        c.name AS cust_name,
        c.email AS cust_email,
        c.phone AS cust_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ${invoiceId} AND i.company_id = ${companyId}
      LIMIT 1
    `;

    const inv = mapInvoiceRow(fullRows[0]);
    const lines = listLineItemsForInvoiceIds([invoiceId]).filter((r) => r.invoice_id === invoiceId);

    return NextResponse.json({ invoice: { ...inv, line_items: lines } });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

type LineInBody = {
  name?: string;
  description?: string | null;
  quantity?: number;
  unit_price_cents?: number;
  catalog_service_id?: string | null;
};

function normalizeInvoiceLineItems(rawLines: LineInBody[]) {
  const normalizedLines: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unit_price_cents: number;
    catalog_service_id: string | null;
  }> = [];

  for (const line of rawLines) {
    const name = String(line.name || '').trim();
    const unit = Math.max(0, Math.round(Number(line.unit_price_cents) || 0));
    const qty = Math.max(0.0001, Number(line.quantity) || 1);
    if (!name || unit <= 0) {
      return {
        error: 'Each line needs a name and a unit price greater than zero.',
        normalizedLines: [] as typeof normalizedLines,
        subtotalCents: 0,
      };
    }
    normalizedLines.push({
      name,
      description: line.description != null ? String(line.description).trim() || null : null,
      quantity: qty,
      unit_price_cents: unit,
      catalog_service_id: line.catalog_service_id ? String(line.catalog_service_id) : null,
    });
  }

  const subtotalCents = normalizedLines.reduce(
    (s, it) => s + Math.round(it.quantity * it.unit_price_cents),
    0,
  );
  if (normalizedLines.length > 0 && subtotalCents <= 0) {
    return { error: 'Invoice subtotal must be greater than zero.', normalizedLines, subtotalCents };
  }
  return { normalizedLines, subtotalCents };
}

export async function PUT(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, line_items: lineItemsInput, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const existing = await sql`
      SELECT *
      FROM invoices
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const cur = existing[0];

    const pendingPay = await sql`
      SELECT 1 FROM payments
      WHERE source_type = 'invoice_payment' AND source_id = ${id} AND status = 'pending'
      LIMIT 1
    `;

    const isLineItemsUpdate = Array.isArray(lineItemsInput);
    const amountChanging =
      updates.amount !== undefined ||
      updates.tax !== undefined ||
      updates.total !== undefined ||
      isLineItemsUpdate;

    if (pendingPay.length && amountChanging) {
      return NextResponse.json(
        { error: 'Cannot change invoice amounts while a payment session is pending. Wait for payment or cancel in Stripe.' },
        { status: 409 },
      );
    }

    const nextCustomerId = updates.customer_id ?? cur.customer_id;
    if (nextCustomerId != null && !(await customerExistsInCompany(portal.companyId, String(nextCustomerId)))) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
    }

    let nextJobId = updates.job_id ?? cur.job_id;
    if (nextJobId != null) {
      const job = await loadJobForCompany(portal.companyId, String(nextJobId));
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 400 });
      }
      nextJobId = String(job.id);
    }

    let normalizedFromLines: ReturnType<typeof normalizeInvoiceLineItems>['normalizedLines'] | null =
      null;
    let subtotalCentsFromLines: number | null = null;
    let serviceTypeFromLines: string | null = null;

    if (isLineItemsUpdate) {
      const rawLines = lineItemsInput as LineInBody[];
      if (rawLines.length === 0) {
        return NextResponse.json({ error: 'Add at least one line item.' }, { status: 400 });
      }
      const parsed = normalizeInvoiceLineItems(rawLines);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      normalizedFromLines = parsed.normalizedLines;
      subtotalCentsFromLines = parsed.subtotalCents;
      if (normalizedFromLines.length === 1) {
        serviceTypeFromLines = normalizedFromLines[0].name;
      } else {
        serviceTypeFromLines = `Multiple services (${normalizedFromLines.length})`;
      }
    }

    let paidDate: string | null = (cur.paid_date as string | null) ?? null;
    if (updates.status === 'paid') {
      paidDate = (updates.paid_date as string) || todayIsoDate();
    } else if (updates.status != null && updates.status !== 'paid') {
      paidDate = null;
    } else if (updates.paid_date !== undefined) {
      paidDate = updates.paid_date as string | null;
    }

    const nextAmount = isLineItemsUpdate
      ? (subtotalCentsFromLines as number) / 100
      : toMoney(updates.amount !== undefined ? updates.amount : cur.amount);
    const nextTax = toMoney(updates.tax !== undefined ? updates.tax : cur.tax);
    const nextTaxCents = Math.round(nextTax * 100);
    const nextAmountCents = isLineItemsUpdate
      ? (subtotalCentsFromLines as number)
      : Math.round(nextAmount * 100);
    const nextTotalCents = isLineItemsUpdate
      ? (subtotalCentsFromLines as number) + nextTaxCents
      : Math.round(
          toMoney(
            updates.total !== undefined ? updates.total : cur.total,
            nextAmount + nextTax,
          ) * 100,
        );
    const nextTotal = nextTotalCents / 100;

    await sql`
      UPDATE invoices SET
        company_id = ${portal.companyId},
        customer_id = ${nextCustomerId},
        job_id = ${nextJobId},
        invoice_number = ${updates.invoice_number ?? cur.invoice_number},
        service_type = ${isLineItemsUpdate ? serviceTypeFromLines : (updates.service_type ?? cur.service_type)},
        status = ${updates.status ?? cur.status},
        amount = ${nextAmount},
        tax = ${nextTax},
        total = ${nextTotal},
        amount_cents = ${nextAmountCents},
        tax_cents = ${nextTaxCents},
        total_cents = ${nextTotalCents},
        issue_date = ${updates.issue_date ?? cur.issue_date},
        due_date = ${updates.due_date ?? cur.due_date},
        paid_date = ${paidDate},
        notes = ${updates.notes ?? cur.notes},
        updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${portal.companyId}
    `;

    if (isLineItemsUpdate && normalizedFromLines && normalizedFromLines.length > 0) {
      await deleteInvoiceLineItems(id);
      await insertInvoiceLineItems(id, normalizedFromLines);
    }

    const fullRows = await sql`
      SELECT
        i.*,
        c.name AS cust_name,
        c.email AS cust_email,
        c.phone AS cust_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ${id} AND i.company_id = ${portal.companyId}
      LIMIT 1
    `;

    const inv = mapInvoiceRow(fullRows[0]);
    const lineRows = listLineItemsForInvoiceIds([id]).filter((r) => r.invoice_id === id);
    return NextResponse.json({ invoice: { ...inv, line_items: lineRows } });
  } catch (error: unknown) {
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
    const existing = await sql`
      SELECT id
      FROM invoices
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await sql`DELETE FROM invoices WHERE id = ${id} AND company_id = ${portal.companyId}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
