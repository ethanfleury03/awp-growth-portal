import { pgTable, text, timestamp, integer, real, uuid, index } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';
import { customers, jobs } from './customers';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    invoiceNumber: text('invoice_number').notNull().unique(),
    serviceType: text('service_type'),
    status: text('status').default('pending'),
    amount: real('amount').notNull(),
    tax: real('tax').default(0),
    total: real('total').notNull(),
    amountCents: integer('amount_cents'),
    taxCents: integer('tax_cents'),
    totalCents: integer('total_cents'),
    publicPayToken: text('public_pay_token').notNull().unique(),
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date'),
    paidDate: text('paid_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_invoices_company_id').on(t.companyId),
    customerIdx: index('idx_invoices_customer_id').on(t.customerId),
    jobIdx: index('idx_invoices_job_id').on(t.jobId),
    statusIdx: index('idx_invoices_status').on(t.status),
  }),
);

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    name: text('name').notNull(),
    description: text('description'),
    quantity: real('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    lineTotalCents: integer('line_total_cents').notNull().default(0),
    catalogServiceId: uuid('catalog_service_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index('idx_invoice_line_items_invoice').on(t.invoiceId),
  }),
);
