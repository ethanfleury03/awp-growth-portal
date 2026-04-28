import { describe, expect, it, vi } from 'vitest';
import { assertStatusTransition } from '@/lib/estimates/validation';
import { calculateEstimateTotals, lineExtendedCents } from '@/lib/estimates/totals';
import Database from 'better-sqlite3';
import { allocateEstimateNumber } from '@/lib/estimates/number';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require('node:os');
  const dbPath = p.join(o.tmpdir(), `plumber-est-vitest-${process.pid}.db`);
  try {
    f.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
});

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import { createCatalogService } from '@/lib/estimates/catalog-services';
import {
  addEstimateLineItem,
  approveEstimateByToken,
  convertEstimateToJob,
  createEstimate,
  duplicateEstimate,
  getEstimateByPublicToken,
  rejectEstimateByToken,
  sendEstimate,
} from '@/lib/estimates/service';

describe('estimate totals', () => {
  it('computes line extended cents with quantity', () => {
    expect(lineExtendedCents(2, 1500)).toBe(3000);
    expect(lineExtendedCents(1.5, 1000)).toBe(1500);
  });

  it('applies discount then tax on taxable portion only', () => {
    const t = calculateEstimateTotals({
      lines: [
        { quantity: 1, unit_price_cents: 10_000, is_taxable: true },
        { quantity: 1, unit_price_cents: 5_000, is_taxable: false },
      ],
      discount_amount_cents: 3000,
      tax_rate_basis_points: 1000,
    });
    expect(t.subtotal_amount_cents).toBe(15_000);
    expect(t.discount_amount_cents).toBe(3000);
    expect(t.total_amount_cents).toBe(12_800);
  });
});

describe('status transitions', () => {
  it('allows draft to sent', () => {
    expect(() => assertStatusTransition('draft', 'sent')).not.toThrow();
  });
  it('blocks draft to approved', () => {
    expect(() => assertStatusTransition('draft', 'approved')).toThrow();
  });
});

describe('estimate number allocation', () => {
  it('increments per company and year', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT, email TEXT);
      INSERT INTO companies VALUES ('c1', 'Co', 'co@test.com');
      CREATE TABLE estimate_number_sequences (
        company_id TEXT NOT NULL REFERENCES companies(id),
        year INTEGER NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, year)
      );`);
    const a = allocateEstimateNumber(db, 'c1', 'EST');
    const b = allocateEstimateNumber(db, 'c1', 'EST');
    expect(a).toMatch(/^EST-\d{4}-0001$/);
    expect(b).toMatch(/^EST-\d{4}-0002$/);
    db.close();
  });
});

describe('estimate service integration', () => {
  it('creates, lines, send, public approve, convert, blocks duplicate convert', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM jobs`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;

    await sql`INSERT INTO companies (id, name, email) VALUES ('c1', 'Test Co', 'testco@example.com')`;

    const est = await createEstimate({
      company_id: 'c1',
      title: 'Water heater scope',
      customer_id: null,
      lead_id: null,
    });
    const id = est.id as string;
    const token = est.customer_public_token as string;

    await addEstimateLineItem(id, {
      name: 'Labor',
      quantity: 2,
      unit: 'hr',
      unit_price_cents: 12_500,
      is_taxable: true,
    });
    await addEstimateLineItem(id, {
      name: 'Trip',
      quantity: 1,
      unit: 'ea',
      unit_price_cents: 89_00,
      is_taxable: false,
    });

    const row = (await sql`SELECT total_amount_cents, subtotal_amount_cents FROM estimates WHERE id = ${id}`)[0] as {
      total_amount_cents: number;
      subtotal_amount_cents: number;
    };
    expect(row.subtotal_amount_cents).toBeGreaterThan(0);

    await sql`UPDATE estimates SET status = 'sent', customer_email_snapshot = 'cust@example.com' WHERE id = ${id}`;
    await sendEstimate(id, { recipientEmail: 'cust@example.com' });

    const pub = await getEstimateByPublicToken(token);
    expect(pub?.status).toBe('sent');

    await approveEstimateByToken(token);
    const approved = await getEstimateByPublicToken(token);
    expect(approved?.status).toBe('approved');

    const { job } = await convertEstimateToJob(id);
    expect(job.id).toBeTruthy();

    await expect(convertEstimateToJob(id)).rejects.toThrow('Already converted');

    resetSqliteSingletonForTests();
  });

  it('reject by token respects settings', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM jobs`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('c2', 'Co2', 'co2@example.com')`;

    const est = await createEstimate({ company_id: 'c2', title: 'R' });
    const id = est.id as string;
    const token = est.customer_public_token as string;
    await sql`UPDATE estimates SET status = 'sent' WHERE id = ${id}`;
    await sql`UPDATE estimate_settings SET allow_customer_reject = 0 WHERE company_id = 'c2'`;

    await expect(rejectEstimateByToken(token, 'no')).rejects.toThrow();

    await sql`UPDATE estimate_settings SET allow_customer_reject = 1 WHERE company_id = 'c2'`;
    await rejectEstimateByToken(token, 'too high');
    const r = await getEstimateByPublicToken(token);
    expect(r?.status).toBe('rejected');

    resetSqliteSingletonForTests();
  });

  it('duplicates estimate with new number', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM jobs`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('c3', 'Co3', 'co3@example.com')`;

    const est = await createEstimate({ company_id: 'c3', title: 'Dup source' });
    const id = est.id as string;
    await addEstimateLineItem(id, { name: 'A', quantity: 1, unit: 'ea', unit_price_cents: 100 });
    const dup = await duplicateEstimate(id);
    expect(dup.estimate_number).not.toBe(est.estimate_number);
    expect(Number(dup.version_number)).toBeGreaterThan(Number(est.version_number));

    resetSqliteSingletonForTests();
  });

  it('create estimate with catalog_service_ids adds line items', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM estimate_catalog_services`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('c4', 'Co4', 'co4@example.com')`;

    const svc = await createCatalogService('c4', {
      name: 'Drain clear',
      description: 'Main line',
      unit_price_cents: 12_500,
    });
    const est = await createEstimate({
      company_id: 'c4',
      title: 'Quote with catalog',
      catalog_service_ids: [svc.id],
    });
    const lines = await sql`SELECT name, unit_price_cents, description FROM estimate_line_items WHERE estimate_id = ${est.id as string}`;
    expect(lines.length).toBe(1);
    expect(String((lines[0] as { name: string }).name)).toBe('Drain clear');
    expect(Number((lines[0] as { unit_price_cents: number }).unit_price_cents)).toBe(12_500);

    resetSqliteSingletonForTests();
  });

  it('create estimate with initial_line_items and discount', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM estimate_catalog_services`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('c5', 'Co5', 'co5@example.com')`;

    const est = await createEstimate({
      company_id: 'c5',
      title: 'Custom lines',
      discount_amount_cents: 1_000,
      initial_line_items: [
        {
          name: 'Labor',
          description: '2 hr',
          quantity: 2,
          unit: 'ea',
          unit_price_cents: 5_000,
          is_taxable: true,
        },
      ],
    });
    const lines = await sql`SELECT name FROM estimate_line_items WHERE estimate_id = ${est.id as string}`;
    expect(lines.length).toBe(1);
    const row = (await sql`SELECT total_amount_cents, discount_amount_cents FROM estimates WHERE id = ${est.id as string}`)[0] as {
      total_amount_cents: number;
      discount_amount_cents: number;
    };
    expect(Number(row.discount_amount_cents)).toBe(1_000);
    expect(Number(row.total_amount_cents)).toBeGreaterThan(0);

    resetSqliteSingletonForTests();
  });
});
