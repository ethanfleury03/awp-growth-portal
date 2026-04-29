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

export const companySettings = pgTable('company_settings', {
  companyId: uuid('company_id')
    .primaryKey()
    .references(() => companies.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  legalName: text('legal_name'),
  industry: text('industry').notNull().default('generic'),
  timezone: text('timezone').notNull().default('America/New_York'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').notNull().default('#f26a1f'),
  accentColor: text('accent_color').notNull().default('#2563eb'),
  portalTitle: text('portal_title').notNull().default('WNY Automation Portal'),
  workspaceLabel: text('workspace_label').notNull().default('Automation workspace'),
  defaultRoute: text('default_route').notNull().default('/app'),
  configJson: text('config_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const companyCustomFields = pgTable(
  'company_custom_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    fieldKey: text('field_key').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('text'),
    required: boolean('required').notNull().default(false),
    optionsJson: text('options_json'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyEntityIdx: index('idx_company_custom_fields_company_entity').on(
      t.companyId,
      t.entityType,
    ),
    uniqueField: uniqueIndex('idx_company_custom_fields_unique').on(
      t.companyId,
      t.entityType,
      t.fieldKey,
    ),
  }),
);

export const companyPipelineStages = pgTable(
  'company_pipeline_stages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    stageKey: text('stage_key').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull().default('#2563eb'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyEntityIdx: index('idx_company_pipeline_stages_company_entity').on(
      t.companyId,
      t.entityType,
    ),
    uniqueStage: uniqueIndex('idx_company_pipeline_stages_unique').on(
      t.companyId,
      t.entityType,
      t.stageKey,
    ),
  }),
);

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
    flagKey: text('flag_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    payloadJson: text('payload_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyKeyIdx: uniqueIndex('idx_feature_flags_company_key').on(t.companyId, t.flagKey),
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
