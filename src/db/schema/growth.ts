import { pgTable, text, timestamp, uuid, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const growthRecords = pgTable(
  'growth_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    recordType: text('record_type').notNull(),
    sourceKey: text('source_key'),
    title: text('title').notNull(),
    status: text('status').notNull().default('Idea'),
    owner: text('owner'),
    relatedRecordId: uuid('related_record_id'),
    payloadJson: text('payload_json'),
    isDemo: boolean('is_demo').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyTypeIdx: index('idx_growth_records_company_type').on(t.companyId, t.recordType),
    sourceKeyIdx: uniqueIndex('idx_growth_records_source_key').on(t.companyId, t.recordType, t.sourceKey),
  }),
);
