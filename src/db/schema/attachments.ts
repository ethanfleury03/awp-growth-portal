import { pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';
import { companies, branches } from './companies';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    uploadedByUserId: text('uploaded_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_attachments_company').on(t.companyId),
    entityIdx: index('idx_attachments_entity').on(t.entityType, t.entityId),
  }),
);
