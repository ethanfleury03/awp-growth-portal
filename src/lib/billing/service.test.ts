import fs from 'fs';
import os from 'os';
import path from 'path';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbPath = path.join(os.tmpdir(), `billing-service-${process.pid}.sqlite`);
process.env.SQLITE_PATH = dbPath;
process.env.STRIPE_PRICE_AWP_CRM_MONTHLY = 'price_test_crm';

const mocks = vi.hoisted(() => ({
  invoiceItemCreate: vi.fn(async () => ({ id: 'ii_ai_overage_1' })),
}));

vi.mock('@/lib/payments/stripe', () => ({
  getStripe: vi.fn(() => ({
    invoiceItems: {
      create: mocks.invoiceItemCreate,
    },
    invoices: {
      list: vi.fn(async () => ({ data: [] })),
    },
  })),
}));

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import { createAiOverageInvoiceItemForInvoice } from '@/lib/billing/service';

async function seedBillingData() {
  const companyId = '00000000-0000-4000-8000-000000000777';
  const conversationId = '00000000-0000-4000-8000-000000000778';
  await sql`
    INSERT INTO companies (id, name, email)
    VALUES (${companyId}, 'Billing Test', 'billing@example.com')
  `;
  await sql`
    INSERT INTO billing_subscriptions (
      id, company_id, stripe_customer_id, stripe_subscription_id, price_id, plan, status, billing_cycle
    ) VALUES (
      ${'00000000-0000-4000-8000-000000000779'},
      ${companyId},
      'cus_test',
      'sub_test',
      'price_test_crm',
      'awp_crm',
      'active',
      'monthly'
    )
  `;
  await sql`
    INSERT INTO ai_conversations (id, company_id, title, selected_model)
    VALUES (${conversationId}, ${companyId}, 'Billing usage', 'deepseek/deepseek-v4-pro')
  `;
  await sql`
    INSERT INTO ai_messages (
      id, company_id, conversation_id, role, content, model, input_tokens, output_tokens, estimated_cost_usd, created_at
    ) VALUES (
      ${'00000000-0000-4000-8000-000000000780'},
      ${companyId},
      ${conversationId},
      'assistant',
      'Tracked response',
      'deepseek/deepseek-v4-pro',
      100,
      50,
      '1.25',
      '2026-05-01 10:00:00'
    )
  `;
  return companyId;
}

describe('billing service', () => {
  beforeEach(() => {
    mocks.invoiceItemCreate.mockClear();
    resetSqliteSingletonForTests();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* test db may not exist yet */
    }
  });

  afterEach(() => {
    resetSqliteSingletonForTests();
  });

  it('creates one idempotent Stripe invoice item for AI overage per subscription period', async () => {
    await seedBillingData();
    const invoice = {
      id: 'in_test',
      status: 'draft',
      customer: 'cus_test',
      subscription: 'sub_test',
      period_start: Date.parse('2026-05-01T00:00:00.000Z') / 1000,
      period_end: Date.parse('2026-06-01T00:00:00.000Z') / 1000,
    } as unknown as Stripe.Invoice;

    await createAiOverageInvoiceItemForInvoice(invoice);
    await createAiOverageInvoiceItemForInvoice(invoice);

    expect(mocks.invoiceItemCreate).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 250,
        currency: 'usd',
        customer: 'cus_test',
        invoice: 'in_test',
      }),
      expect.objectContaining({ idempotencyKey: 'ai-overage:in_test:sub_test' }),
    );

    const rows = await sql`
      SELECT stripe_invoice_item_id, charge_amount_cents, status
      FROM billing_usage_periods
      WHERE stripe_subscription_id = 'sub_test'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        stripe_invoice_item_id: 'ii_ai_overage_1',
        charge_amount_cents: 250,
        status: 'invoice_item_created',
      }),
    );
  });
});
