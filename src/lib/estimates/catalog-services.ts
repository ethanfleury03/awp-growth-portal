import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';

export type CatalogServiceRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listCatalogServices(companyId: string): Promise<CatalogServiceRow[]> {
  const rows = await sql`
    SELECT * FROM estimate_catalog_services
    WHERE company_id = ${companyId}
    ORDER BY sort_order ASC, name ASC, created_at ASC
  `;
  return rows as unknown as CatalogServiceRow[];
}

export async function createCatalogService(
  companyId: string,
  input: { name: string; description?: string | null; unit_price_cents: number },
): Promise<CatalogServiceRow> {
  const id = randomUUID();
  const maxRow = await sql`
    SELECT COALESCE(MAX(sort_order), -1) AS m FROM estimate_catalog_services WHERE company_id = ${companyId}
  `;
  const next = Number((maxRow[0] as { m: number }).m) + 1;
  await sql`
    INSERT INTO estimate_catalog_services (
      id, company_id, name, description, unit_price_cents, sort_order
    ) VALUES (
      ${id},
      ${companyId},
      ${input.name.trim()},
      ${input.description?.trim() || null},
      ${Math.max(0, Math.floor(input.unit_price_cents))},
      ${next}
    )
  `;
  const r = await sql`SELECT * FROM estimate_catalog_services WHERE id = ${id} LIMIT 1`;
  return r[0] as unknown as CatalogServiceRow;
}

export async function updateCatalogService(
  companyId: string,
  id: string,
  patch: Partial<{ name: string; description: string | null; unit_price_cents: number; sort_order: number }>,
): Promise<CatalogServiceRow | null> {
  const cur = (
    await sql`SELECT * FROM estimate_catalog_services WHERE id = ${id} AND company_id = ${companyId} LIMIT 1`
  )[0] as Record<string, unknown> | undefined;
  if (!cur) return null;
  const name = patch.name !== undefined ? patch.name.trim() : (cur.name as string);
  const description = patch.description !== undefined ? patch.description : (cur.description as string | null);
  const unit_price_cents =
    patch.unit_price_cents !== undefined ? Math.max(0, Math.floor(patch.unit_price_cents)) : Number(cur.unit_price_cents);
  const sort_order = patch.sort_order !== undefined ? patch.sort_order : Number(cur.sort_order);
  await sql`
    UPDATE estimate_catalog_services SET
      name = ${name},
      description = ${description},
      unit_price_cents = ${unit_price_cents},
      sort_order = ${sort_order},
      updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${companyId}
  `;
  const r = await sql`SELECT * FROM estimate_catalog_services WHERE id = ${id} LIMIT 1`;
  return r[0] as unknown as CatalogServiceRow;
}

export async function deleteCatalogService(companyId: string, id: string): Promise<boolean> {
  const exists = await sql`SELECT id FROM estimate_catalog_services WHERE id = ${id} AND company_id = ${companyId} LIMIT 1`;
  if (!exists.length) return false;
  await sql`DELETE FROM estimate_catalog_services WHERE id = ${id} AND company_id = ${companyId}`;
  return true;
}

/** Load services for this company in the given id order (skips missing / wrong company). */
export async function getCatalogServicesByIds(
  companyId: string,
  ids: string[],
): Promise<CatalogServiceRow[]> {
  if (!ids.length) return [];
  const out: CatalogServiceRow[] = [];
  for (const sid of ids) {
    const row = (
      await sql`SELECT * FROM estimate_catalog_services WHERE id = ${sid} AND company_id = ${companyId} LIMIT 1`
    )[0] as Record<string, unknown> | undefined;
    if (row) out.push(row as unknown as CatalogServiceRow);
  }
  return out;
}
