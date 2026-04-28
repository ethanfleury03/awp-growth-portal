import { pgTable, text, timestamp, integer, real, boolean, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';
import { customers, jobs, leads, plumbers } from './customers';

export const estimateSettings = pgTable('estimate_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  logoUrl: text('logo_url'),
  accentColor: text('accent_color'),
  estimateFooterText: text('estimate_footer_text'),
  defaultTermsText: text('default_terms_text'),
  defaultExpirationDays: integer('default_expiration_days').notNull().default(30),
  defaultTaxRateBasisPoints: integer('default_tax_rate_basis_points'),
  estimatePrefix: text('estimate_prefix').notNull().default('EST'),
  defaultDepositEnabled: boolean('default_deposit_enabled').notNull().default(false),
  defaultDepositPercentBasisPoints: integer('default_deposit_percent_basis_points'),
  customerSignatureRequired: boolean('customer_signature_required').notNull().default(false),
  allowCustomerReject: boolean('allow_customer_reject').notNull().default(true),
  publicApprovalRequiresToken: boolean('public_approval_requires_token').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const estimates = pgTable(
  'estimates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    estimateNumber: text('estimate_number').notNull().unique(),
    status: text('status').notNull().default('draft'),
    title: text('title').notNull(),
    description: text('description'),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    receptionistCallId: uuid('receptionist_call_id'),
    sourceType: text('source_type'),
    sourceId: text('source_id'),
    createdByPlumberId: uuid('created_by_plumber_id').references(() => plumbers.id, {
      onDelete: 'set null',
    }),
    assignedToPlumberId: uuid('assigned_to_plumber_id').references(() => plumbers.id, {
      onDelete: 'set null',
    }),
    currency: text('currency').notNull().default('USD'),
    subtotalAmountCents: integer('subtotal_amount_cents').notNull().default(0),
    discountAmountCents: integer('discount_amount_cents').notNull().default(0),
    taxAmountCents: integer('tax_amount_cents').notNull().default(0),
    totalAmountCents: integer('total_amount_cents').notNull().default(0),
    depositAmountCents: integer('deposit_amount_cents'),
    companyNameSnapshot: text('company_name_snapshot').notNull(),
    companyEmailSnapshot: text('company_email_snapshot'),
    companyPhoneSnapshot: text('company_phone_snapshot'),
    companyAddressSnapshot: text('company_address_snapshot'),
    customerNameSnapshot: text('customer_name_snapshot').notNull(),
    customerEmailSnapshot: text('customer_email_snapshot'),
    customerPhoneSnapshot: text('customer_phone_snapshot'),
    serviceAddressSnapshot: text('service_address_snapshot'),
    notesInternal: text('notes_internal'),
    notesCustomer: text('notes_customer'),
    expirationDate: text('expiration_date'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    convertedToJobId: uuid('converted_to_job_id').references(() => jobs.id, { onDelete: 'set null' }),
    depositStatus: text('deposit_status').notNull().default('none'),
    depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
    customerPublicToken: text('customer_public_token').notNull().unique(),
    versionNumber: integer('version_number').notNull().default(1),
    parentEstimateId: uuid('parent_estimate_id'),
    selectedOptionGroup: text('selected_option_group'),
    taxRateBasisPoints: integer('tax_rate_basis_points'),
    signatureAttachmentId: uuid('signature_attachment_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_estimates_company').on(t.companyId),
    statusIdx: index('idx_estimates_status').on(t.status),
    customerIdx: index('idx_estimates_customer').on(t.customerId),
    leadIdx: index('idx_estimates_lead').on(t.leadId),
    jobIdx: index('idx_estimates_job').on(t.jobId),
    receptionistCallIdx: index('idx_estimates_receptionist_call').on(t.receptionistCallId),
    createdIdx: index('idx_estimates_created').on(t.createdAt),
  }),
);

export const estimateLineItems = pgTable(
  'estimate_line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    estimateId: uuid('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    category: text('category'),
    name: text('name').notNull(),
    description: text('description'),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('ea'),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    totalPriceCents: integer('total_price_cents').notNull().default(0),
    isOptional: boolean('is_optional').notNull().default(false),
    isTaxable: boolean('is_taxable').notNull().default(true),
    optionGroup: text('option_group'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    estimateIdx: index('idx_estimate_line_items_estimate').on(t.estimateId),
  }),
);

export const estimateActivity = pgTable(
  'estimate_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    estimateId: uuid('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json'),
    actorType: text('actor_type').notNull().default('system'),
    actorId: text('actor_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    estimateIdx: index('idx_estimate_activity_estimate').on(t.estimateId),
  }),
);

export const estimateDelivery = pgTable(
  'estimate_delivery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    estimateId: uuid('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    deliveryType: text('delivery_type').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    bodySnapshot: text('body_snapshot'),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    status: text('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    estimateIdx: index('idx_estimate_delivery_estimate').on(t.estimateId),
  }),
);

export const estimateCatalogServices = pgTable(
  'estimate_catalog_services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_estimate_catalog_services_company').on(t.companyId),
  }),
);

// Avoid unused imports warning when only used for side effects on forward refs.
export const _internal = { uniqueIndex };
