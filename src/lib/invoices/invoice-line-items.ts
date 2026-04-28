import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import { sql } from '@/lib/db';

export type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  sort_order: number;
  name: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  catalog_service_id: string | null;
};

export function listLineItemsForInvoiceIds(invoiceIds: string[]): InvoiceLineItemRow[] {
  if (invoiceIds.length === 0) return [];
  const db = getDb();
  const ph = invoiceIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM invoice_line_items WHERE invoice_id IN (${ph}) ORDER BY invoice_id, sort_order ASC, id ASC`,
    )
    .all(...invoiceIds) as InvoiceLineItemRow[];
  return rows;
}

export function groupLineItemsByInvoiceId(rows: InvoiceLineItemRow[]): Map<string, InvoiceLineItemRow[]> {
  const m = new Map<string, InvoiceLineItemRow[]>();
  for (const r of rows) {
    const id = r.invoice_id;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(r);
  }
  return m;
}

export async function deleteInvoiceLineItems(invoiceId: string): Promise<void> {
  await sql`DELETE FROM invoice_line_items WHERE invoice_id = ${invoiceId}`;
}

export async function insertInvoiceLineItems(
  invoiceId: string,
  items: Array<{
    name: string;
    description?: string | null;
    quantity: number;
    unit_price_cents: number;
    catalog_service_id?: string | null;
  }>,
): Promise<void> {
  let order = 0;
  for (const it of items) {
    const qty = Math.max(0.0001, Number(it.quantity) || 1);
    const unit = Math.max(0, Math.round(it.unit_price_cents));
    const lineTotal = Math.round(qty * unit);
    const id = randomUUID();
    await sql`
      INSERT INTO invoice_line_items (
        id, invoice_id, sort_order, name, description, quantity,
        unit_price_cents, line_total_cents, catalog_service_id
      ) VALUES (
        ${id},
        ${invoiceId},
        ${order},
        ${it.name.trim()},
        ${it.description?.trim() || null},
        ${qty},
        ${unit},
        ${lineTotal},
        ${it.catalog_service_id ?? null}
      )
    `;
    order += 1;
  }
}
