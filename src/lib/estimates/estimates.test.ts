import { describe, expect, it, vi } from 'vitest';
import { assertStatusTransition } from '@/lib/estimates/validation';
import { calculateEstimateTotals, lineExtendedCents } from '@/lib/estimates/totals';
import { allocateEstimateNumber } from '@/lib/estimates/number';
import { ManualCopyEstimateDeliveryProvider, pickEmailProvider } from '@/lib/estimates/delivery';

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
  getEstimateByIdForCompany,
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
  it('increments per company and year', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('c1', 'Co', 'co@test.com')`;
    const a = await allocateEstimateNumber('c1', 'EST');
    const b = await allocateEstimateNumber('c1', 'EST');
    expect(a).toMatch(/^EST-\d{4}-0001$/);
    expect(b).toMatch(/^EST-\d{4}-0002$/);
  });
});

describe('estimate delivery providers', () => {
  it('does not default to mock delivery in production', () => {
    const provider = pickEmailProvider({ APP_ENV: 'production', NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(provider.name).toBe('email_stub');
  });

  it('uses an explicit manual-copy provider when no recipient exists', async () => {
    const provider = new ManualCopyEstimateDeliveryProvider();
    const result = await provider.send({
      estimateId: 'est_1',
      estimateNumber: 'EST-2026-0001',
      customerName: 'Customer',
      title: 'Scope',
      totalCents: 1000,
      expirationDate: null,
      publicUrl: 'https://example.com/estimate',
      recipientEmail: null,
    });

    expect(result.provider).toBe('manual_copy_link');
    expect(result.status).toBe('sent');
    expect(result.provider_message_id).toBeNull();
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

  it('scopes estimate reads and linked records to the creating company', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM estimate_delivery`;
    await sql`DELETE FROM estimate_activity`;
    await sql`DELETE FROM estimate_line_items`;
    await sql`DELETE FROM estimates`;
    await sql`DELETE FROM jobs`;
    await sql`DELETE FROM leads`;
    await sql`DELETE FROM customers`;
    await sql`DELETE FROM plumbers`;
    await sql`DELETE FROM estimate_settings`;
    await sql`DELETE FROM estimate_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-a', 'Tenant A', 'a@example.com')`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-b', 'Tenant B', 'b@example.com')`;
    await sql`
      INSERT INTO customers (id, company_id, name, email, phone)
      VALUES ('cust-a', 'tenant-a', 'Alice', 'alice@example.com', '111')
    `;
    await sql`
      INSERT INTO customers (id, company_id, name, email, phone)
      VALUES ('cust-b', 'tenant-b', 'Bob', 'bob@example.com', '222')
    `;

    await expect(
      createEstimate({
        company_id: 'tenant-a',
        title: 'Cross-tenant customer attempt',
        customer_id: 'cust-b',
      }),
    ).rejects.toThrow('Customer not found');

    const estimate = await createEstimate({
      company_id: 'tenant-a',
      title: 'Tenant A estimate',
      customer_id: 'cust-a',
    });

    expect(await getEstimateByIdForCompany(estimate.id as string, 'tenant-a')).toBeTruthy();
    expect(await getEstimateByIdForCompany(estimate.id as string, 'tenant-b')).toBeNull();

    resetSqliteSingletonForTests();
  });
});
