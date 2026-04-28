import { pgTable, text, timestamp, integer, boolean, uuid, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  address: text('address'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeAccountId: text('stripe_account_id'),
  stripeConnectStatus: text('stripe_connect_status').default('pending'),
  stripeOnboardingCompletedAt: timestamp('stripe_onboarding_completed_at', { withTimezone: true }),
  subscriptionTier: text('subscription_tier').default('free'),
  subscriptionStatus: text('subscription_status').default('active'),
  twilioPhoneNumber: text('twilio_phone_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code'),
    phone: text('phone'),
    address: text('address'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_branches_company_id').on(t.companyId),
    primaryPerCompany: uniqueIndex('idx_branches_company_primary')
      .on(t.companyId)
      .where(sql`is_primary = true`),
  }),
);

export const companyPhoneNumbers = pgTable(
  'company_phone_numbers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    phoneE164: text('phone_e164').notNull().unique(),
    label: text('label'),
    provider: text('provider').default('twilio'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_company_phone_numbers_company').on(t.companyId),
  }),
);

export const companyPaymentSettings = pgTable('company_payment_settings', {
  companyId: uuid('company_id')
    .primaryKey()
    .references(() => companies.id, { onDelete: 'cascade' }),
  onlinePaymentsEnabled: boolean('online_payments_enabled').notNull().default(false),
  estimateDepositsEnabled: boolean('estimate_deposits_enabled').notNull().default(false),
  invoicePaymentsEnabled: boolean('invoice_payments_enabled').notNull().default(false),
  depositDueTiming: text('deposit_due_timing').notNull().default('with_approval'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceNumberSequences = pgTable(
  'invoice_number_sequences',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    lastSeq: integer('last_seq').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.year] }),
  }),
);

export const estimateNumberSequences = pgTable(
  'estimate_number_sequences',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    lastSeq: integer('last_seq').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.year] }),
  }),
);

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull().default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyKeyIdx: uniqueIndex('idx_feature_flags_company_key').on(t.companyId, t.key),
  }),
);

export const webhookFailures = pgTable(
  'webhook_failures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    eventType: text('event_type'),
    externalEventId: text('external_event_id'),
    payloadJson: text('payload_json'),
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    status: text('status').notNull().default('pending'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_webhook_failures_status').on(t.status),
    providerIdx: index('idx_webhook_failures_provider').on(t.provider),
  }),
);
