import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { allocateInvoiceNumber } from '@/lib/invoices/number';

describe('invoice number allocation', () => {
  it('increments per company and year with a company-specific prefix fragment', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT, email TEXT);
      INSERT INTO companies VALUES ('acme-123', 'Acme', 'acme@example.com');
      CREATE TABLE invoice_number_sequences (
        company_id TEXT NOT NULL REFERENCES companies(id),
        year INTEGER NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, year)
      );
    `);

    const a = allocateInvoiceNumber(db, 'acme-123');
    const b = allocateInvoiceNumber(db, 'acme-123');

    expect(a).toMatch(/^INV-ACME-\d{4}-0001$/);
    expect(b).toMatch(/^INV-ACME-\d{4}-0002$/);
    db.close();
  });

  it('tracks sequences independently per company', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT, email TEXT);
      INSERT INTO companies VALUES ('acme-123', 'Acme', 'acme@example.com');
      INSERT INTO companies VALUES ('beta-456', 'Beta', 'beta@example.com');
      CREATE TABLE invoice_number_sequences (
        company_id TEXT NOT NULL REFERENCES companies(id),
        year INTEGER NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, year)
      );
    `);

    const acme = allocateInvoiceNumber(db, 'acme-123');
    const beta = allocateInvoiceNumber(db, 'beta-456');

    expect(acme).toMatch(/^INV-ACME-\d{4}-0001$/);
    expect(beta).toMatch(/^INV-BETA-\d{4}-0001$/);
    db.close();
  });
});
