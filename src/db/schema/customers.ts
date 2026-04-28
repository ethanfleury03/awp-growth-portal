import { pgTable, text, timestamp, integer, boolean, uuid, real, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';

export const plumbers = pgTable(
  'plumbers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    role: text('role').default('plumber'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_plumbers_company_id').on(t.companyId),
  }),
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone').notNull(),
    address: text('address'),
    notes: text('notes'),
    emailOptIn: boolean('email_opt_in').notNull().default(true),
    smsOptIn: boolean('sms_opt_in').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_customers_company_id').on(t.companyId),
    companyPhoneIdx: index('idx_customers_company_phone').on(t.companyId, t.phone),
  }),
);

export const buckets = pgTable(
  'buckets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    color: text('color').default('#6b7280'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_buckets_company').on(t.companyId),
    companyPositionIdx: uniqueIndex('idx_buckets_company_position').on(t.companyId, t.position),
  }),
);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    plumberId: uuid('plumber_id').references(() => plumbers.id, { onDelete: 'set null' }),
    source: text('source').notNull(),
    status: text('status').default('new'),
    priority: integer('priority').default(3),
    issue: text('issue').notNull(),
    description: text('description'),
    location: text('location'),
    aiQualification: text('ai_qualification'),
    aiScore: integer('ai_score'),
    leadContextJson: text('lead_context_json'),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    estimatedValueCents: integer('estimated_value_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_leads_company_id').on(t.companyId),
    customerIdx: index('idx_leads_customer_id').on(t.customerId),
    statusIdx: index('idx_leads_status').on(t.status),
  }),
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    plumberId: uuid('plumber_id').references(() => plumbers.id, { onDelete: 'set null' }),
    status: text('status').default('scheduled'),
    type: text('type').notNull(),
    description: text('description'),
    scheduledDate: text('scheduled_date'),
    scheduledTime: text('scheduled_time'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    estimatedPrice: real('estimated_price'),
    finalPrice: real('final_price'),
    notes: text('notes'),
    sourceEstimateId: uuid('source_estimate_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_jobs_company_id').on(t.companyId),
    customerIdx: index('idx_jobs_customer_id').on(t.customerId),
    leadIdx: index('idx_jobs_lead_id').on(t.leadId),
    statusIdx: index('idx_jobs_status').on(t.status),
  }),
);

export const callLogs = pgTable(
  'call_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    customerName: text('customer_name'),
    phoneNumber: text('phone_number').notNull(),
    durationSeconds: integer('duration_seconds').default(0),
    status: text('status').default('completed'),
    transcript: text('transcript'),
    aiSummary: text('ai_summary'),
    outcome: text('outcome'),
    recording: boolean('recording').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_call_logs_company_id').on(t.companyId),
    createdIdx: index('idx_call_logs_created_at').on(t.createdAt),
  }),
);
