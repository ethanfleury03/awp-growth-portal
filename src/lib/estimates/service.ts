import { randomBytes, randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { getDb } from '@/lib/db';
import { allocateEstimateNumber } from '@/lib/estimates/number';
import {
  buildEstimateEmailCopy,
  pickEmailProvider,
  TwilioSmsEstimateDeliveryProvider,
  MockEstimateDeliveryProvider,
  type DeliveryResult,
  type DeliverySendInput,
} from '@/lib/estimates/delivery';
import { sendEstimateViaClerkMailbox } from '@/lib/estimates/clerk-mailbox';
import { calculateEstimateTotals, lineExtendedCents, type LineInput } from '@/lib/estimates/totals';
import type { ActivityEventType, EstimateStatus } from '@/lib/estimates/types';
import { assertStatusTransition } from '@/lib/estimates/validation';
import { getCatalogServicesByIds } from '@/lib/estimates/catalog-services';
import { getCompanyPaymentSettings } from '@/lib/payments/company-settings';
import { stripeConfigured, estimateDepositAmountCents, depositBlocksPublicApproval } from '@/lib/payments/policy';

async function sendEmailWithMailboxFirst(
  clerkUserId: string | null | undefined,
  input: DeliverySendInput,
): Promise<DeliveryResult> {
  if (clerkUserId) {
    const mb = await sendEstimateViaClerkMailbox(clerkUserId, input);
    if (mb.status === 'sent') return mb;
  }
  return pickEmailProvider().send(input);
}

function publicAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    'http://localhost:3003'
  ).replace(/\/$/, '');
}

export async function getDefaultCompanyId(explicit?: string | null): Promise<string> {
  if (explicit) return explicit;
  const rows = await sql`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`;
  const id = rows[0]?.id as string | undefined;
  if (!id) throw new Error('No company found. Run setup or create a company first.');
  return id;
}

export async function ensureEstimateSettings(companyId: string): Promise<Record<string, unknown>> {
  const rows = await sql`SELECT * FROM estimate_settings WHERE company_id = ${companyId} LIMIT 1`;
  if (rows.length) return rows[0] as Record<string, unknown>;
  const comp = (await sql`SELECT name, email, phone, address FROM companies WHERE id = ${companyId} LIMIT 1`)[0] as
    | Record<string, unknown>
    | undefined;
  const name = (comp?.name as string) || 'Company';
  const sid = randomUUID();
  await sql`
    INSERT INTO estimate_settings (
      id, company_id, company_name, estimate_prefix, default_expiration_days,
      default_terms_text, estimate_footer_text
    ) VALUES (
      ${sid},
      ${companyId},
      ${name},
      'EST',
      30,
      ${'Payment due as agreed. Prices valid for the period shown on this estimate.'},
      ${'Thank you for choosing us for your plumbing needs.'}
    )
  `;
  const again = await sql`SELECT * FROM estimate_settings WHERE company_id = ${companyId} LIMIT 1`;
  return again[0] as Record<string, unknown>;
}

async function logActivity(
  estimateId: string,
  eventType: ActivityEventType,
  payload: Record<string, unknown> | null,
  actorType: string,
  actorId: string | null,
) {
  const aid = randomUUID();
  await sql`
    INSERT INTO estimate_activity (id, estimate_id, event_type, payload_json, actor_type, actor_id)
    VALUES (
      ${aid},
      ${estimateId},
      ${eventType},
      ${payload ? JSON.stringify(payload) : null},
      ${actorType},
      ${actorId}
    )
  `;
}

export async function loadLineInputs(estimateId: string): Promise<LineInput[]> {
  const lines = await sql`
    SELECT quantity, unit_price_cents, is_taxable FROM estimate_line_items
    WHERE estimate_id = ${estimateId}
    ORDER BY sort_order ASC, created_at ASC
  `;
  return lines.map((r) => ({
    quantity: Number(r.quantity) || 0,
    unit_price_cents: Number(r.unit_price_cents) || 0,
    is_taxable: Boolean(r.is_taxable),
  }));
}

export async function recalculateAndPersistEstimate(estimateId: string): Promise<void> {
  const est = (await sql`SELECT discount_amount_cents, tax_rate_basis_points FROM estimates WHERE id = ${estimateId} LIMIT 1`)[0] as
    | { discount_amount_cents: number; tax_rate_basis_points: number | null }
    | undefined;
  if (!est) return;
  const lines = await loadLineInputs(estimateId);
  const totals = calculateEstimateTotals({
    lines,
    discount_amount_cents: Number(est.discount_amount_cents) || 0,
    tax_rate_basis_points: est.tax_rate_basis_points,
  });

  await sql`
    UPDATE estimates SET
      subtotal_amount_cents = ${totals.subtotal_amount_cents},
      discount_amount_cents = ${totals.discount_amount_cents},
      tax_amount_cents = ${totals.tax_amount_cents},
      total_amount_cents = ${totals.total_amount_cents},
      updated_at = datetime('now')
    WHERE id = ${estimateId}
  `;

  for (const row of await sql`SELECT id, quantity, unit_price_cents FROM estimate_line_items WHERE estimate_id = ${estimateId}`) {
    const ext = lineExtendedCents(Number(row.quantity), Number(row.unit_price_cents));
    await sql`UPDATE estimate_line_items SET total_price_cents = ${ext}, updated_at = datetime('now') WHERE id = ${row.id as string}`;
  }
}

export async function getEstimateDashboardStats(companyId: string) {
  const rows = await sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) AS viewed,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,
      SUM(COALESCE(total_amount_cents, 0)) AS value_cents
    FROM estimates
    WHERE company_id = ${companyId}
  `;
  const r = rows[0] as Record<string, unknown>;
  const sentPlus = Number(r.sent || 0) + Number(r.viewed || 0) + Number(r.approved || 0) + Number(r.rejected || 0);
  const approved = Number(r.approved || 0);
  const rejected = Number(r.rejected || 0);
  const denom = approved + rejected;
  const approval_rate = denom > 0 ? approved / denom : null;
  return {
    total: Number(r.total || 0),
    draft: Number(r.draft || 0),
    sent: Number(r.sent || 0),
    viewed: Number(r.viewed || 0),
    approved,
    rejected,
    expired: Number(r.expired || 0),
    converted: Number(r.converted || 0),
    total_value_cents: Number(r.value_cents || 0),
    approval_rate,
    sent_funnel: sentPlus,
  };
}

export async function listEstimates(params: {
  companyId: string;
  status?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
  customer_id?: string | null;
  lead_id?: string | null;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  let listQuery = sql`
    SELECT e.*, c.name AS customer_join_name
    FROM estimates e
    LEFT JOIN customers c ON e.customer_id = c.id
    WHERE e.company_id = ${params.companyId}
  `;
  let countQuery = sql`
    SELECT COUNT(*) AS n
    FROM estimates e
    LEFT JOIN customers c ON e.customer_id = c.id
    WHERE e.company_id = ${params.companyId}
  `;
  if (params.customer_id) {
    listQuery = sql`${listQuery} AND e.customer_id = ${params.customer_id}`;
    countQuery = sql`${countQuery} AND e.customer_id = ${params.customer_id}`;
  }
  if (params.lead_id) {
    listQuery = sql`${listQuery} AND e.lead_id = ${params.lead_id}`;
    countQuery = sql`${countQuery} AND e.lead_id = ${params.lead_id}`;
  }
  if (params.status && params.status !== 'all') {
    listQuery = sql`${listQuery} AND e.status = ${params.status}`;
    countQuery = sql`${countQuery} AND e.status = ${params.status}`;
  }
  if (params.search?.trim()) {
    const q = `%${params.search.trim()}%`;
    const searchFrag = sql` AND (
      e.estimate_number LIKE ${q} OR e.title LIKE ${q} OR e.customer_name_snapshot LIKE ${q}
      OR c.name LIKE ${q}
    )`;
    listQuery = sql`${listQuery}${searchFrag}`;
    countQuery = sql`${countQuery}${searchFrag}`;
  }

  const countRow = await countQuery;
  const total = Number((countRow[0] as { n: number }).n || 0);

  const rows = await sql`
    ${listQuery}
    ORDER BY e.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return { estimates: rows, total, page, limit };
}

export async function getEstimateById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await sql`SELECT * FROM estimates WHERE id = ${id} LIMIT 1`;
  return rows[0] ? (rows[0] as Record<string, unknown>) : null;
}

export async function getEstimateByPublicToken(token: string): Promise<Record<string, unknown> | null> {
  const rows = await sql`SELECT * FROM estimates WHERE customer_public_token = ${token} LIMIT 1`;
  return rows[0] ? (rows[0] as Record<string, unknown>) : null;
}

export async function getLineItems(estimateId: string) {
  return sql`
    SELECT * FROM estimate_line_items WHERE estimate_id = ${estimateId}
    ORDER BY sort_order ASC, created_at ASC
  `;
}

export async function expireEstimateIfNeeded(row: Record<string, unknown>): Promise<EstimateStatus | null> {
  const status = row.status as EstimateStatus;
  if (status === 'expired' || status === 'converted' || status === 'rejected' || status === 'approved') return null;
  const exp = row.expiration_date as string | null;
  if (!exp) return null;
  const expMs = Date.parse(exp);
  if (!Number.isFinite(expMs) || Date.now() <= expMs) return null;
  const id = row.id as string;
  await sql`UPDATE estimates SET status = 'expired', expired_at = datetime('now'), updated_at = datetime('now') WHERE id = ${id}`;
  await logActivity(id, 'expired', { at: new Date().toISOString() }, 'system', null);
  return 'expired';
}

export type CreateEstimateInput = {
  company_id?: string | null;
  title: string;
  description?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  receptionist_call_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  assigned_to_plumber_id?: string | null;
  notes_internal?: string | null;
  notes_customer?: string | null;
  expiration_date?: string | null;
  discount_amount_cents?: number;
  tax_rate_basis_points?: number | null;
  deposit_amount_cents?: number | null;
  selected_option_group?: string | null;
  /** After create, add line items from these catalog service ids (same company). */
  catalog_service_ids?: string[] | null;
  /** After create, add these line items (takes precedence over catalog_service_ids). */
  initial_line_items?: Array<{
    catalog_service_id?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    is_taxable?: boolean;
  }> | null;
};

export async function createEstimate(input: CreateEstimateInput): Promise<Record<string, unknown>> {
  const companyId = await getDefaultCompanyId(input.company_id);
  const settings = await ensureEstimateSettings(companyId);
  const prefix = (settings.estimate_prefix as string) || 'EST';

  const comp = (await sql`SELECT name, email, phone, address FROM companies WHERE id = ${companyId} LIMIT 1`)[0] as Record<
    string,
    unknown
  >;

  let customerName = 'Customer';
  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  let serviceAddress: string | null = null;

  if (input.customer_id) {
    const c = (await sql`SELECT name, email, phone, address FROM customers WHERE id = ${input.customer_id} LIMIT 1`)[0] as
      | Record<string, unknown>
      | undefined;
    if (c) {
      customerName = (c.name as string) || customerName;
      customerEmail = (c.email as string) || null;
      customerPhone = (c.phone as string) || null;
      serviceAddress = (c.address as string) || null;
    }
  }
  if (input.lead_id) {
    const l = (await sql`SELECT issue, location, customer_id FROM leads WHERE id = ${input.lead_id} LIMIT 1`)[0] as
      | Record<string, unknown>
      | undefined;
    if (l) {
      if (!input.customer_id && l.customer_id) {
        input.customer_id = l.customer_id as string;
        const c = (await sql`SELECT name, email, phone, address FROM customers WHERE id = ${input.customer_id} LIMIT 1`)[0] as
          | Record<string, unknown>
          | undefined;
        if (c) {
          customerName = (c.name as string) || customerName;
          customerEmail = (c.email as string) || null;
          customerPhone = (c.phone as string) || null;
          serviceAddress = (c.address as string) || serviceAddress;
        }
      }
      if (!serviceAddress && l.location) serviceAddress = l.location as string;
    }
  }

  if (input.job_id) {
    const j = (
      await sql`
      SELECT j.description, j.customer_id, c.name AS cn, c.email AS ce, c.phone AS cp, c.address AS ca
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      WHERE j.id = ${input.job_id} LIMIT 1
    `
    )[0] as Record<string, unknown> | undefined;
    if (j) {
      if (!input.customer_id && j.customer_id) {
        input.customer_id = j.customer_id as string;
      }
      if (j.cn) customerName = (j.cn as string) || customerName;
      if (j.ce) customerEmail = (j.ce as string) || customerEmail;
      if (j.cp) customerPhone = (j.cp as string) || customerPhone;
      if (j.ca) serviceAddress = (j.ca as string) || serviceAddress;
    }
  }

  if (input.receptionist_call_id) {
    const call = (
      await sql`SELECT caller_name, from_phone, extracted_json FROM receptionist_calls WHERE id = ${input.receptionist_call_id} LIMIT 1`
    )[0] as Record<string, unknown> | undefined;
    if (call?.caller_name) customerName = (call.caller_name as string) || customerName;
    if (call?.from_phone && !customerPhone) customerPhone = call.from_phone as string;
    try {
      const ex = call?.extracted_json ? JSON.parse(String(call.extracted_json)) : null;
      if (ex && typeof ex === 'object') {
        const addr = (ex as { address?: string }).address;
        if (addr && !serviceAddress) serviceAddress = addr;
        const ph = (ex as { phone?: string }).phone;
        if (ph && !customerPhone) customerPhone = ph;
      }
    } catch {
      /* ignore */
    }
  }

  const token = randomBytes(24).toString('hex');
  const db = getDb();
  const estimateNumber = allocateEstimateNumber(db, companyId, prefix);

  let expiration = input.expiration_date ?? null;
  if (!expiration) {
    const days = Number(settings.default_expiration_days) || 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    expiration = d.toISOString().slice(0, 10);
  }

  const taxBps =
    input.tax_rate_basis_points ??
    (settings.default_tax_rate_basis_points == null
      ? null
      : Number(settings.default_tax_rate_basis_points));

  const discount = input.discount_amount_cents ?? 0;
  const estimateId = randomUUID();

  const inserted = await sql`
    INSERT INTO estimates (
      id,
      company_id, estimate_number, status, title, description,
      customer_id, lead_id, job_id, receptionist_call_id, source_type, source_id,
      assigned_to_plumber_id, currency,
      subtotal_amount_cents, discount_amount_cents, tax_amount_cents, total_amount_cents,
      deposit_amount_cents,
      company_name_snapshot, company_email_snapshot, company_phone_snapshot, company_address_snapshot,
      customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot, service_address_snapshot,
      notes_internal, notes_customer, expiration_date, customer_public_token,
      version_number, tax_rate_basis_points, selected_option_group
    ) VALUES (
      ${estimateId},
      ${companyId},
      ${estimateNumber},
      'draft',
      ${input.title},
      ${input.description ?? null},
      ${input.customer_id ?? null},
      ${input.lead_id ?? null},
      ${input.job_id ?? null},
      ${input.receptionist_call_id ?? null},
      ${input.source_type ?? null},
      ${input.source_id ?? null},
      ${input.assigned_to_plumber_id ?? null},
      'USD',
      0,
      ${discount},
      0,
      0,
      ${input.deposit_amount_cents ?? null},
      ${String(comp?.name || 'Company')},
      ${(comp?.email as string) || null},
      ${(comp?.phone as string) || null},
      ${(comp?.address as string) || null},
      ${customerName},
      ${customerEmail},
      ${customerPhone},
      ${serviceAddress},
      ${input.notes_internal ?? null},
      ${input.notes_customer ?? null},
      ${expiration},
      ${token},
      1,
      ${taxBps},
      ${input.selected_option_group ?? null}
    )
    RETURNING *
  `;

  const row = inserted[0] as Record<string, unknown>;
  const estimateRowId = row.id as string;
  await logActivity(estimateRowId, 'created', { title: input.title }, 'system', null);

  const initialLines = input.initial_line_items?.filter((l) => l.name?.trim()) ?? [];
  if (initialLines.length) {
    for (const li of initialLines) {
      await addEstimateLineItem(estimateRowId, {
        name: li.name.trim(),
        description: li.description?.trim() || null,
        quantity: li.quantity,
        unit: li.unit || 'ea',
        unit_price_cents: li.unit_price_cents,
        is_taxable: li.is_taxable !== false,
        category: li.catalog_service_id ? 'Service' : null,
      });
    }
  } else {
    const catIds = input.catalog_service_ids?.filter(Boolean) ?? [];
    if (catIds.length) {
      const services = await getCatalogServicesByIds(companyId, catIds);
      for (const svc of services) {
        await addEstimateLineItem(estimateRowId, {
          name: svc.name,
          description: svc.description ?? null,
          quantity: 1,
          unit: 'ea',
          unit_price_cents: svc.unit_price_cents,
          is_taxable: true,
          category: 'Service',
        });
      }
    }
  }
  await recalculateAndPersistEstimate(estimateRowId);

  return (await sql`SELECT * FROM estimates WHERE id = ${estimateRowId} LIMIT 1`)[0] as Record<string, unknown>;
}

export async function updateEstimate(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: EstimateStatus;
    notes_internal: string | null;
    notes_customer: string | null;
    expiration_date: string | null;
    discount_amount_cents: number;
    tax_rate_basis_points: number | null;
    deposit_amount_cents: number | null;
    assigned_to_plumber_id: string | null;
    selected_option_group: string | null;
  }>,
): Promise<Record<string, unknown> | null> {
  const cur = await getEstimateById(id);
  if (!cur) return null;
  const from = cur.status as EstimateStatus;
  if (patch.status && patch.status !== from) {
    assertStatusTransition(from, patch.status);
  }
  if (from === 'converted' && patch.status && patch.status !== 'converted') {
    throw new Error('Cannot change a converted estimate');
  }

  const title = patch.title !== undefined ? patch.title : (cur.title as string);
  const description = patch.description !== undefined ? patch.description : (cur.description as string | null);
  const status = patch.status !== undefined ? patch.status : from;
  const notes_internal = patch.notes_internal !== undefined ? patch.notes_internal : (cur.notes_internal as string | null);
  const notes_customer = patch.notes_customer !== undefined ? patch.notes_customer : (cur.notes_customer as string | null);
  const expiration_date =
    patch.expiration_date !== undefined ? patch.expiration_date : (cur.expiration_date as string | null);
  const discount_amount_cents =
    patch.discount_amount_cents !== undefined ? patch.discount_amount_cents : Number(cur.discount_amount_cents) || 0;
  const tax_rate_basis_points =
    patch.tax_rate_basis_points !== undefined ? patch.tax_rate_basis_points : (cur.tax_rate_basis_points as number | null);
  const deposit_amount_cents =
    patch.deposit_amount_cents !== undefined ? patch.deposit_amount_cents : (cur.deposit_amount_cents as number | null);
  const assigned_to_plumber_id =
    patch.assigned_to_plumber_id !== undefined ? patch.assigned_to_plumber_id : (cur.assigned_to_plumber_id as string | null);
  const selected_option_group =
    patch.selected_option_group !== undefined ? patch.selected_option_group : (cur.selected_option_group as string | null);

  await sql`
    UPDATE estimates SET
      title = ${title},
      description = ${description},
      status = ${status},
      notes_internal = ${notes_internal},
      notes_customer = ${notes_customer},
      expiration_date = ${expiration_date},
      discount_amount_cents = ${discount_amount_cents},
      tax_rate_basis_points = ${tax_rate_basis_points},
      deposit_amount_cents = ${deposit_amount_cents},
      assigned_to_plumber_id = ${assigned_to_plumber_id},
      selected_option_group = ${selected_option_group},
      updated_at = datetime('now')
    WHERE id = ${id}
  `;

  await recalculateAndPersistEstimate(id);
  await logActivity(id, 'updated', { patch: Object.keys(patch) }, 'system', null);
  return getEstimateById(id);
}

export async function archiveEstimate(id: string) {
  await sql`UPDATE estimates SET status = 'archived', updated_at = datetime('now') WHERE id = ${id}`;
  await logActivity(id, 'archived', {}, 'system', null);
}

export async function addEstimateLineItem(
  estimateId: string,
  item: {
    category?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    is_optional?: boolean;
    is_taxable?: boolean;
    option_group?: string | null;
    sort_order?: number;
  },
): Promise<Record<string, unknown>> {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  if ((est.status as string) === 'converted') throw new Error('Cannot edit converted estimate');
  if ((est.status as string) === 'approved') throw new Error('Approve flow: duplicate to revise an approved estimate');

  const maxRow = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM estimate_line_items WHERE estimate_id = ${estimateId}`;
  const nextOrder = item.sort_order ?? Number((maxRow[0] as { m: number }).m) + 1;
  const ext = lineExtendedCents(item.quantity, item.unit_price_cents);
  const lineItemId = randomUUID();
  const inserted = await sql`
    INSERT INTO estimate_line_items (
      id,
      estimate_id, sort_order, category, name, description, quantity, unit,
      unit_price_cents, total_price_cents, is_optional, is_taxable, option_group
    ) VALUES (
      ${lineItemId},
      ${estimateId},
      ${nextOrder},
      ${item.category ?? null},
      ${item.name},
      ${item.description ?? null},
      ${item.quantity},
      ${item.unit},
      ${item.unit_price_cents},
      ${ext},
      ${item.is_optional ? 1 : 0},
      ${item.is_taxable === false ? 0 : 1},
      ${item.option_group ?? null}
    )
    RETURNING *
  `;
  await recalculateAndPersistEstimate(estimateId);
  await logActivity(estimateId, 'line_item_added', { line_id: (inserted[0] as { id: string }).id }, 'system', null);
  return inserted[0] as Record<string, unknown>;
}

export async function updateEstimateLineItem(
  estimateId: string,
  lineId: string,
  patch: Partial<{
    category: string | null;
    name: string;
    description: string | null;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    is_optional: boolean;
    is_taxable: boolean;
    option_group: string | null;
    sort_order: number;
  }>,
) {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  if ((est.status as string) === 'converted' || (est.status as string) === 'approved')
    throw new Error('Cannot edit line items on approved/converted estimates');

  const line = (await sql`SELECT * FROM estimate_line_items WHERE id = ${lineId} AND estimate_id = ${estimateId} LIMIT 1`)[0] as
    | Record<string, unknown>
    | undefined;
  if (!line) throw new Error('Line item not found');

  const category = patch.category !== undefined ? patch.category : (line.category as string | null);
  const name = patch.name !== undefined ? patch.name : (line.name as string);
  const description = patch.description !== undefined ? patch.description : (line.description as string | null);
  const q = patch.quantity !== undefined ? patch.quantity : Number(line.quantity);
  const unit = patch.unit !== undefined ? patch.unit : (line.unit as string);
  const up = patch.unit_price_cents !== undefined ? patch.unit_price_cents : Number(line.unit_price_cents);
  const ext = lineExtendedCents(q, up);
  const is_optional = patch.is_optional !== undefined ? (patch.is_optional ? 1 : 0) : Number(line.is_optional);
  const is_taxable = patch.is_taxable !== undefined ? (patch.is_taxable ? 1 : 0) : Number(line.is_taxable);
  const option_group = patch.option_group !== undefined ? patch.option_group : (line.option_group as string | null);
  const sort_order = patch.sort_order !== undefined ? patch.sort_order : Number(line.sort_order);

  await sql`
    UPDATE estimate_line_items SET
      category = ${category},
      name = ${name},
      description = ${description},
      quantity = ${q},
      unit = ${unit},
      unit_price_cents = ${up},
      total_price_cents = ${ext},
      is_optional = ${is_optional},
      is_taxable = ${is_taxable},
      option_group = ${option_group},
      sort_order = ${sort_order},
      updated_at = datetime('now')
    WHERE id = ${lineId}
  `;
  await recalculateAndPersistEstimate(estimateId);
  await logActivity(estimateId, 'line_item_updated', { line_id: lineId }, 'system', null);
}

export async function deleteEstimateLineItem(estimateId: string, lineId: string) {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  if ((est.status as string) === 'converted' || (est.status as string) === 'approved')
    throw new Error('Cannot delete line items on approved/converted estimates');
  await sql`DELETE FROM estimate_line_items WHERE id = ${lineId} AND estimate_id = ${estimateId}`;
  await recalculateAndPersistEstimate(estimateId);
  await logActivity(estimateId, 'line_item_deleted', { line_id: lineId }, 'system', null);
}

export async function reorderEstimateLineItems(estimateId: string, orderedIds: string[]) {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  if ((est.status as string) === 'converted' || (est.status as string) === 'approved')
    throw new Error('Cannot reorder on approved/converted estimates');
  let i = 0;
  for (const lid of orderedIds) {
    await sql`UPDATE estimate_line_items SET sort_order = ${i}, updated_at = datetime('now') WHERE id = ${lid} AND estimate_id = ${estimateId}`;
    i += 1;
  }
  await logActivity(estimateId, 'updated', { reorder: true }, 'system', null);
}

export async function sendEstimate(
  estimateId: string,
  opts?: {
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    channel?: 'email' | 'sms' | 'auto';
    emailSubject?: string | null;
    emailBody?: string | null;
    /** When Clerk is enabled, tries Gmail / Microsoft Graph before Resend. */
    clerkUserId?: string | null;
  },
) {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  const st = est.status as EstimateStatus;
  if (st !== 'draft' && st !== 'sent' && st !== 'viewed') throw new Error('Estimate cannot be sent from this status');

  const base = publicAppBaseUrl();
  const publicUrl = `${base}/estimate/${est.customer_public_token as string}`;
  const email = opts?.recipientEmail?.trim() || (est.customer_email_snapshot as string) || '';
  const phone = opts?.recipientPhone?.trim() || (est.customer_phone_snapshot as string) || '';
  const channel = opts?.channel ?? 'auto';

  const inputBase: DeliverySendInput = {
    estimateId,
    estimateNumber: String(est.estimate_number),
    customerName: String(est.customer_name_snapshot),
    title: String(est.title),
    totalCents: Number(est.total_amount_cents) || 0,
    expirationDate: (est.expiration_date as string) || null,
    publicUrl,
    recipientEmail: null,
    recipientPhone: null,
    emailSubject: opts?.emailSubject ?? null,
    emailBody: opts?.emailBody ?? null,
  };

  let result: DeliveryResult;
  let deliveryType: string;
  let recipientRecord: string;

  if (channel === 'sms') {
    const sms = new TwilioSmsEstimateDeliveryProvider();
    result = await sms.send({ ...inputBase, recipientEmail: null, recipientPhone: phone || null });
    deliveryType = 'sms_share_link';
    recipientRecord = phone || publicUrl;
  } else if (channel === 'email') {
    result = await sendEmailWithMailboxFirst(opts?.clerkUserId, {
      ...inputBase,
      recipientEmail: email || null,
    });
    deliveryType = email ? 'email' : 'manual_copy_link';
    recipientRecord = email || publicUrl;
  } else {
    if (email) {
      result = await sendEmailWithMailboxFirst(opts?.clerkUserId, {
        ...inputBase,
        recipientEmail: email,
      });
      deliveryType = 'email';
      recipientRecord = email;
    } else if (phone) {
      const sms = new TwilioSmsEstimateDeliveryProvider();
      result = await sms.send({ ...inputBase, recipientEmail: null, recipientPhone: phone });
      deliveryType = 'sms_share_link';
      recipientRecord = phone;
    } else {
      const mock = new MockEstimateDeliveryProvider();
      result = await mock.send({ ...inputBase, recipientEmail: null });
      deliveryType = 'manual_copy_link';
      recipientRecord = publicUrl;
    }
  }

  const deliveryStatus = result.status === 'sent' ? 'sent' : 'failed';
  const deliveryId = randomUUID();
  await sql`
    INSERT INTO estimate_delivery (
      id,
      estimate_id, delivery_type, recipient, subject, body_snapshot, provider, provider_message_id, status, sent_at, failed_at, error_message
    ) VALUES (
      ${deliveryId},
      ${estimateId},
      ${deliveryType},
      ${recipientRecord},
      ${result.subject},
      ${result.body},
      ${result.provider},
      ${result.provider_message_id},
      ${deliveryStatus},
      ${result.status === 'sent' ? new Date().toISOString() : null},
      ${result.status === 'failed' ? new Date().toISOString() : null},
      ${result.error_message ?? null}
    )
  `;

  if (result.status === 'sent') {
    const prev = st;
    await sql`
      UPDATE estimates SET
        status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
        sent_at = COALESCE(sent_at, datetime('now')),
        updated_at = datetime('now')
      WHERE id = ${estimateId}
    `;
    await logActivity(estimateId, prev === 'draft' ? 'sent' : 'resent', { provider: result.provider }, 'system', null);
  }

  return { publicUrl, delivery: result };
}

export async function markEstimateViewedByToken(token: string) {
  const row = await getEstimateByPublicToken(token);
  if (!row) return null;
  await expireEstimateIfNeeded(row);
  const fresh = await getEstimateByPublicToken(token);
  if (!fresh) return null;
  if ((fresh.status as string) === 'expired') return fresh;

  if (fresh.status === 'sent') {
    await sql`UPDATE estimates SET status = 'viewed', viewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ${fresh.id as string}`;
    await logActivity(fresh.id as string, 'viewed', {}, 'customer', null);
  } else {
    await sql`UPDATE estimates SET viewed_at = COALESCE(viewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ${fresh.id as string}`;
  }
  await logActivity(fresh.id as string, 'public_link_opened', {}, 'customer', null);
  return getEstimateByPublicToken(token);
}

export async function approveEstimateByToken(
  token: string,
  opts?: { acknowledge?: boolean; signerName?: string | null },
) {
  const row = await getEstimateByPublicToken(token);
  if (!row) throw new Error('Not found');
  await expireEstimateIfNeeded(row);
  const fresh = (await getEstimateByPublicToken(token))!;
  if ((fresh.status as string) === 'expired') throw new Error('Estimate expired');
  if ((fresh.status as string) === 'draft') throw new Error('Estimate has not been sent yet');
  if ((fresh.status as string) === 'approved') return fresh;
  if ((fresh.status as string) === 'rejected') throw new Error('Already rejected');
  if ((fresh.status as string) === 'converted') throw new Error('Already converted');

  const companyId = fresh.company_id as string;
  const settings = await ensureEstimateSettings(companyId);
  if (Number(settings.customer_signature_required)) {
    if (!opts?.acknowledge) {
      throw new Error('Please confirm that you approve this estimate (checkbox required).');
    }
  }

  const { depositBlocksPublicApproval } = await import('@/lib/payments/policy');
  if (await depositBlocksPublicApproval(fresh)) {
    throw new Error(
      'Please pay the required deposit online to approve this estimate (use Pay deposit on the estimate page).',
    );
  }

  await sql`
    UPDATE estimates SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ${fresh.id as string}
  `;
  await logActivity(fresh.id as string, 'approved', { signer_name: opts?.signerName ?? null }, 'customer', null);
  return getEstimateByPublicToken(token);
}

export async function rejectEstimateByToken(token: string, reason?: string | null) {
  const row = await getEstimateByPublicToken(token);
  if (!row) throw new Error('Not found');
  const companyId = row.company_id as string;
  const settings = await ensureEstimateSettings(companyId);
  if (!Number(settings.allow_customer_reject)) {
    throw new Error('Rejection disabled for this company');
  }
  await expireEstimateIfNeeded(row);
  const fresh = (await getEstimateByPublicToken(token))!;
  if ((fresh.status as string) === 'expired') throw new Error('Estimate expired');
  if ((fresh.status as string) === 'approved') throw new Error('Already approved');
  if ((fresh.status as string) === 'rejected') return fresh;

  await sql`
    UPDATE estimates SET status = 'rejected', rejected_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ${fresh.id as string}
  `;
  await logActivity(fresh.id as string, 'rejected', { reason: reason ?? null }, 'customer', null);
  return getEstimateByPublicToken(token);
}

export async function approveEstimateManually(id: string) {
  const est = await getEstimateById(id);
  if (!est) throw new Error('Not found');
  const st = est.status as EstimateStatus;
  if (st === 'converted') throw new Error('Already converted');
  if (st === 'approved') return est;
  if (st === 'expired') throw new Error('Expired estimate must be duplicated or re-dated before approval');
  const { depositBlocksConvert } = await import('@/lib/payments/policy');
  if (await depositBlocksConvert(est)) {
    await sql`
      UPDATE estimates SET
        status = 'approved',
        approved_at = datetime('now'),
        deposit_status = 'waived',
        updated_at = datetime('now')
      WHERE id = ${id}
    `;
    await logActivity(id, 'manually_approved', { deposit: 'waived_by_staff' }, 'staff', null);
  } else {
    await sql`UPDATE estimates SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ${id}`;
    await logActivity(id, 'manually_approved', {}, 'staff', null);
  }
  return getEstimateById(id);
}

export async function rejectEstimateManually(id: string) {
  const est = await getEstimateById(id);
  if (!est) throw new Error('Not found');
  const st = est.status as EstimateStatus;
  if (st === 'converted') throw new Error('Already converted');
  await sql`UPDATE estimates SET status = 'rejected', rejected_at = datetime('now'), updated_at = datetime('now') WHERE id = ${id}`;
  await logActivity(id, 'manually_rejected', {}, 'staff', null);
  return getEstimateById(id);
}

export async function convertEstimateToJob(estimateId: string): Promise<{ job: Record<string, unknown>; estimate: Record<string, unknown> }> {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Estimate not found');
  if (est.converted_to_job_id || (est.status as string) === 'converted') {
    throw new Error('Already converted');
  }
  if ((est.status as string) !== 'approved') throw new Error('Only approved estimates can be converted');

  const { depositBlocksConvert } = await import('@/lib/payments/policy');
  if (await depositBlocksConvert(est)) {
    throw new Error('Deposit must be collected (or waived by staff approval) before converting to a job.');
  }

  const companyId = est.company_id as string;
  const type = (est.title as string).slice(0, 120) || 'Estimate work';
  const descriptionParts = [est.description as string | null, est.notes_customer as string | null].filter(Boolean);
  const description = descriptionParts.join('\n\n') || null;
  const notes = [`From estimate ${est.estimate_number}`, est.notes_internal as string | null].filter(Boolean).join('\n');

  const jobId = randomUUID();
  const jobInsert = await sql`
    INSERT INTO jobs (
      id,
      company_id, lead_id, customer_id, status, type, description, notes, estimated_price
    ) VALUES (
      ${jobId},
      ${companyId},
      ${(est.lead_id as string) || null},
      ${(est.customer_id as string) || null},
      'scheduled',
      ${type},
      ${description},
      ${notes || null},
      ${(Number(est.total_amount_cents) || 0) / 100}
    )
    RETURNING *
  `;
  const job = jobInsert[0] as Record<string, unknown>;

  await sql`UPDATE jobs SET source_estimate_id = ${estimateId}, updated_at = datetime('now') WHERE id = ${job.id as string}`;
  await sql`
    UPDATE estimates SET
      status = 'converted',
      converted_to_job_id = ${job.id as string},
      updated_at = datetime('now')
    WHERE id = ${estimateId}
  `;
  await logActivity(estimateId, 'converted_to_job', { job_id: job.id }, 'system', null);

  return { job, estimate: (await getEstimateById(estimateId))! };
}

export async function duplicateEstimate(estimateId: string): Promise<Record<string, unknown>> {
  const est = await getEstimateById(estimateId);
  if (!est) throw new Error('Not found');
  const companyId = est.company_id as string;
  const settings = await ensureEstimateSettings(companyId);
  const prefix = (settings.estimate_prefix as string) || 'EST';
  const token = randomBytes(24).toString('hex');
  const db = getDb();
  const estimateNumber = allocateEstimateNumber(db, companyId, prefix);
  const ver = Number(est.version_number) + 1;
  const newEstimateId = randomUUID();

  const inserted = await sql`
    INSERT INTO estimates (
      id,
      company_id, estimate_number, status, title, description,
      customer_id, lead_id, job_id, receptionist_call_id, source_type, source_id,
      assigned_to_plumber_id, currency,
      subtotal_amount_cents, discount_amount_cents, tax_amount_cents, total_amount_cents,
      deposit_amount_cents,
      company_name_snapshot, company_email_snapshot, company_phone_snapshot, company_address_snapshot,
      customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot, service_address_snapshot,
      notes_internal, notes_customer, expiration_date, customer_public_token,
      version_number, parent_estimate_id, tax_rate_basis_points, selected_option_group
    ) VALUES (
      ${newEstimateId},
      ${companyId},
      ${estimateNumber},
      'draft',
      ${est.title},
      ${est.description},
      ${est.customer_id},
      ${est.lead_id},
      ${est.job_id},
      ${est.receptionist_call_id},
      ${est.source_type},
      ${est.source_id},
      ${est.assigned_to_plumber_id},
      ${est.currency || 'USD'},
      ${est.subtotal_amount_cents},
      ${est.discount_amount_cents},
      ${est.tax_amount_cents},
      ${est.total_amount_cents},
      ${est.deposit_amount_cents},
      ${est.company_name_snapshot},
      ${est.company_email_snapshot},
      ${est.company_phone_snapshot},
      ${est.company_address_snapshot},
      ${est.customer_name_snapshot},
      ${est.customer_email_snapshot},
      ${est.customer_phone_snapshot},
      ${est.service_address_snapshot},
      ${est.notes_internal},
      ${est.notes_customer},
      ${est.expiration_date},
      ${token},
      ${ver},
      ${estimateId},
      ${est.tax_rate_basis_points},
      ${est.selected_option_group}
    )
    RETURNING *
  `;
  const newRow = inserted[0] as Record<string, unknown>;
  const newId = newRow.id as string;

  const lines = await sql`SELECT * FROM estimate_line_items WHERE estimate_id = ${estimateId} ORDER BY sort_order`;
  for (const li of lines) {
    const l = li as Record<string, unknown>;
    const dupLineId = randomUUID();
    await sql`
      INSERT INTO estimate_line_items (
        id,
        estimate_id, sort_order, category, name, description, quantity, unit,
        unit_price_cents, total_price_cents, is_optional, is_taxable, option_group
      ) VALUES (
        ${dupLineId},
        ${newId},
        ${l.sort_order},
        ${l.category},
        ${l.name},
        ${l.description},
        ${l.quantity},
        ${l.unit},
        ${l.unit_price_cents},
        ${l.total_price_cents},
        ${l.is_optional},
        ${l.is_taxable},
        ${l.option_group}
      )
    `;
  }

  await recalculateAndPersistEstimate(newId);
  await logActivity(newId, 'created', { duplicated_from: estimateId }, 'system', null);
  await logActivity(estimateId, 'duplicated', { new_estimate_id: newId }, 'system', null);
  return (await getEstimateById(newId))!;
}

export async function buildEstimatePresentation(estimateId: string, opts?: { internal?: boolean }) {
  const est = await getEstimateById(estimateId);
  if (!est) return null;
  const lines = await getLineItems(estimateId);
  const settings = await ensureEstimateSettings(est.company_id as string);
  const publicUrl = `${publicAppBaseUrl()}/estimate/${est.customer_public_token}`;

  const companyId = est.company_id as string;
  const paySettings = await getCompanyPaymentSettings(companyId);
  const depCents = estimateDepositAmountCents(est);
  const depStat = String(est.deposit_status || 'none');
  const stripeOn = stripeConfigured();
  const mustPayBeforeApprove = await depositBlocksPublicApproval(est);
  const payment = {
    stripeSecretConfigured: stripeOn,
    onlinePaymentsEnabled: paySettings.online_payments_enabled,
    estimateDepositsEnabled: paySettings.estimate_deposits_enabled,
    invoicePaymentsEnabled: paySettings.invoice_payments_enabled,
    depositAmountCents: depCents,
    depositStatus: depStat,
    mustPayBeforeApprove,
    depositCheckoutAvailable:
      stripeOn &&
      paySettings.online_payments_enabled &&
      paySettings.estimate_deposits_enabled &&
      depCents > 0,
  };

  const estView = opts?.internal ? est : { ...est, notes_internal: undefined };
  const emailDraftInput: DeliverySendInput = {
    estimateId,
    estimateNumber: String(est.estimate_number),
    customerName: String(est.customer_name_snapshot),
    title: String(est.title),
    totalCents: Number(est.total_amount_cents) || 0,
    expirationDate: (est.expiration_date as string) || null,
    publicUrl,
    recipientEmail: null,
  };
  const template = buildEstimateEmailCopy(emailDraftInput);
  const emailDraft = opts?.internal
    ? {
        defaultSubject: template.subject,
        defaultBody: template.body,
        toEmail: (est.customer_email_snapshot as string) || null,
        customerPhone: (est.customer_phone_snapshot as string) || null,
      }
    : undefined;

  return {
    estimate: estView,
    lineItems: lines,
    branding: {
      companyName: settings.company_name,
      logoUrl: settings.logo_url,
      accentColor: settings.accent_color || '#0f766e',
      footer: settings.estimate_footer_text,
      terms: settings.default_terms_text,
    },
    approval: {
      customerSignatureRequired: Boolean(Number(settings.customer_signature_required)),
      allowCustomerReject: Boolean(Number(settings.allow_customer_reject)),
    },
    publicUrl,
    payment,
    ...(emailDraft ? { emailDraft } : {}),
  };
}

export async function getEstimateActivity(estimateId: string) {
  return sql`SELECT * FROM estimate_activity WHERE estimate_id = ${estimateId} ORDER BY created_at DESC`;
}

export async function getEstimateDeliveries(estimateId: string) {
  return sql`SELECT * FROM estimate_delivery WHERE estimate_id = ${estimateId} ORDER BY created_at DESC`;
}

export async function patchEstimateSettings(
  companyId: string,
  patch: Partial<{
    company_name: string;
    logo_url: string | null;
    accent_color: string | null;
    estimate_footer_text: string | null;
    default_terms_text: string | null;
    default_expiration_days: number;
    default_tax_rate_basis_points: number | null;
    estimate_prefix: string;
    default_deposit_enabled: boolean;
    default_deposit_percent_basis_points: number | null;
    customer_signature_required: boolean;
    allow_customer_reject: boolean;
    public_approval_requires_token: boolean;
  }>,
) {
  const cur = (await ensureEstimateSettings(companyId)) as Record<string, unknown>;
  const next = {
    company_name: patch.company_name ?? cur.company_name,
    logo_url: patch.logo_url !== undefined ? patch.logo_url : cur.logo_url,
    accent_color: patch.accent_color !== undefined ? patch.accent_color : cur.accent_color,
    estimate_footer_text:
      patch.estimate_footer_text !== undefined ? patch.estimate_footer_text : cur.estimate_footer_text,
    default_terms_text: patch.default_terms_text !== undefined ? patch.default_terms_text : cur.default_terms_text,
    default_expiration_days:
      patch.default_expiration_days !== undefined ? patch.default_expiration_days : cur.default_expiration_days,
    default_tax_rate_basis_points:
      patch.default_tax_rate_basis_points !== undefined
        ? patch.default_tax_rate_basis_points
        : cur.default_tax_rate_basis_points,
    estimate_prefix: patch.estimate_prefix ?? cur.estimate_prefix,
    default_deposit_enabled:
      patch.default_deposit_enabled !== undefined ? (patch.default_deposit_enabled ? 1 : 0) : cur.default_deposit_enabled,
    default_deposit_percent_basis_points:
      patch.default_deposit_percent_basis_points !== undefined
        ? patch.default_deposit_percent_basis_points
        : cur.default_deposit_percent_basis_points,
    customer_signature_required:
      patch.customer_signature_required !== undefined
        ? patch.customer_signature_required
          ? 1
          : 0
        : cur.customer_signature_required,
    allow_customer_reject:
      patch.allow_customer_reject !== undefined ? (patch.allow_customer_reject ? 1 : 0) : cur.allow_customer_reject,
    public_approval_requires_token:
      patch.public_approval_requires_token !== undefined
        ? patch.public_approval_requires_token
          ? 1
          : 0
        : cur.public_approval_requires_token,
  };

  await sql`
    UPDATE estimate_settings SET
      company_name = ${next.company_name},
      logo_url = ${next.logo_url},
      accent_color = ${next.accent_color},
      estimate_footer_text = ${next.estimate_footer_text},
      default_terms_text = ${next.default_terms_text},
      default_expiration_days = ${next.default_expiration_days},
      default_tax_rate_basis_points = ${next.default_tax_rate_basis_points},
      estimate_prefix = ${next.estimate_prefix},
      default_deposit_enabled = ${next.default_deposit_enabled},
      default_deposit_percent_basis_points = ${next.default_deposit_percent_basis_points},
      customer_signature_required = ${next.customer_signature_required},
      allow_customer_reject = ${next.allow_customer_reject},
      public_approval_requires_token = ${next.public_approval_requires_token},
      updated_at = datetime('now')
    WHERE company_id = ${companyId}
  `;
  const rows = await sql`SELECT * FROM estimate_settings WHERE company_id = ${companyId} LIMIT 1`;
  return rows[0];
}
