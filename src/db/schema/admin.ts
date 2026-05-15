import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { growthRecords } from './growth';

export const adminTicketBuckets = pgTable(
  'admin_ticket_buckets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2f6b4f'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('idx_admin_ticket_buckets_active').on(t.isActive, t.sortOrder),
  }),
);

export const adminTickets = pgTable(
  'admin_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bucketId: uuid('bucket_id')
      .notNull()
      .references(() => adminTicketBuckets.id, { onDelete: 'restrict' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => growthRecords.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull().default('normal'),
    requesterEmail: text('requester_email'),
    source: text('source').notNull().default('admin'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdByUserId: uuid('created_by_user_id'),
    updatedByUserId: uuid('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    bucketOrderIdx: index('idx_admin_tickets_bucket_order').on(t.bucketId, t.sortOrder, t.updatedAt),
    companyIdx: index('idx_admin_tickets_company').on(t.companyId, t.updatedAt),
    projectIdx: index('idx_admin_tickets_project').on(t.projectId),
  }),
);

export const adminTicketComments = pgTable(
  'admin_ticket_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => adminTickets.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id'),
    authorRole: text('author_role').notNull(),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ticketCreatedIdx: index('idx_admin_ticket_comments_ticket_created').on(t.ticketId, t.createdAt),
    companyCreatedIdx: index('idx_admin_ticket_comments_company_created').on(t.companyId, t.createdAt),
  }),
);
