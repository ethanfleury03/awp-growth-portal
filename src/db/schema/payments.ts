import { pgTable, text, timestamp, integer, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    stripeAccountId: text('stripe_account_id'),
    amountCents: integer('amount_cents').notNull(),
    refundedAmountCents: integer('refunded_amount_cents').notNull().default(0),
    applicationFeeCents: integer('application_fee_cents').default(0),
    currency: text('currency').notNull().default('usd'),
    status: text('status').notNull().default('pending'),
    customerEmail: text('customer_email'),
    paymentUrl: text('payment_url'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_payments_company_id').on(t.companyId),
    sourceIdx: index('idx_payments_source').on(t.sourceType, t.sourceId),
    checkoutIdx: index('idx_payments_checkout_session').on(t.stripeCheckoutSessionId),
  }),
);

export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  stripeEventId: text('stripe_event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  payloadJson: text('payload_json'),
});

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    stripeDisputeId: text('stripe_dispute_id').notNull().unique(),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason'),
    status: text('status').notNull(),
    evidenceDueBy: timestamp('evidence_due_by', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_disputes_company_id').on(t.companyId),
  }),
);

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    clerkUserId: text('clerk_user_id'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    priceId: text('price_id'),
    plan: text('plan').notNull(),
    status: text('status').notNull().default('incomplete'),
    billingCycle: text('billing_cycle').notNull().default('monthly'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stripeSubUnique: uniqueIndex('idx_billing_subscriptions_stripe_sub').on(t.stripeSubscriptionId),
    companyIdx: index('idx_billing_subscriptions_company').on(t.companyId),
    statusIdx: index('idx_billing_subscriptions_status').on(t.status),
  }),
);
