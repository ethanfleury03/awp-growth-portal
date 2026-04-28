import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    templateKey: text('template_key').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    body: text('body'),
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    status: text('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_notifications_company').on(t.companyId),
    entityIdx: index('idx_notifications_entity').on(t.entityType, t.entityId),
    statusIdx: index('idx_notifications_status').on(t.status),
  }),
);

export const serviceContracts = pgTable(
  'service_contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').notNull(),
    title: text('title').notNull(),
    cadence: text('cadence').notNull(),
    active: text('active').notNull().default('true'),
    lastMaterializedAt: timestamp('last_materialized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_service_contracts_company').on(t.companyId),
  }),
);

export const serviceContractSchedules = pgTable(
  'service_contract_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => serviceContracts.id, { onDelete: 'cascade' }),
    scheduledDate: text('scheduled_date').notNull(),
    status: text('status').notNull().default('pending'),
    materializedJobId: uuid('materialized_job_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contractIdx: index('idx_service_contract_schedules_contract').on(t.contractId),
  }),
);
