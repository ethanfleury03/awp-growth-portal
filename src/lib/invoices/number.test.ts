import { describe, expect, it, vi } from 'vitest';
import { allocateInvoiceNumber } from '@/lib/invoices/number';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require('node:os');
  const dbPath = p.join(o.tmpdir(), `plumber-invoice-vitest-${process.pid}.db`);
  try {
    f.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
});

import { resetSqliteSingletonForTests, sql } from '@/lib/db';

describe('invoice number allocation', () => {
  it('increments per company and year with a company-specific prefix fragment', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM invoice_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('acme-123', 'Acme', 'acme@example.com')`;

    const a = await allocateInvoiceNumber('acme-123');
    const b = await allocateInvoiceNumber('acme-123');

    expect(a).toMatch(/^INV-ACME-\d{4}-0001$/);
    expect(b).toMatch(/^INV-ACME-\d{4}-0002$/);
  });

  it('tracks sequences independently per company', async () => {
    resetSqliteSingletonForTests();
    await sql`DELETE FROM invoice_number_sequences`;
    await sql`DELETE FROM companies`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('acme-123', 'Acme', 'acme@example.com')`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('beta-456', 'Beta', 'beta@example.com')`;

    const acme = await allocateInvoiceNumber('acme-123');
    const beta = await allocateInvoiceNumber('beta-456');

    expect(acme).toMatch(/^INV-ACME-\d{4}-0001$/);
    expect(beta).toMatch(/^INV-BETA-\d{4}-0001$/);
  });
});
