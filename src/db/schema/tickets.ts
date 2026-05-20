import { boolean, index, text, timestamp, uuid, pgTable } from 'drizzle-orm/pg-core';
import { branches, companies } from './companies';

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    createdByUserId: text('created_by_user_id'),
    createdByName: text('created_by_name'),
    createdByEmail: text('created_by_email'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull().default('general'),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('open'),
    assignedToUserId: text('assigned_to_user_id'),
    discordMessageId: text('discord_message_id'),
    notificationError: text('notification_error'),
    discordNotifiedAt: timestamp('discord_notified_at', { withTimezone: true }),
    solutionSummary: text('solution_summary'),
    solutionDetails: text('solution_details'),
    solutionSource: text('solution_source'),
    solutionExternalId: text('solution_external_id'),
    solutionReportedAt: timestamp('solution_reported_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_tickets_company').on(t.companyId),
    companyStatusIdx: index('idx_tickets_company_status').on(t.companyId, t.status),
    companyActivityIdx: index('idx_tickets_company_activity').on(t.companyId, t.lastActivityAt),
  }),
);

export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id'),
    authorRole: text('author_role').notNull().default('viewer'),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ticketIdx: index('idx_ticket_comments_ticket').on(t.ticketId),
    companyTicketIdx: index('idx_ticket_comments_company_ticket').on(t.companyId, t.ticketId),
  }),
);
