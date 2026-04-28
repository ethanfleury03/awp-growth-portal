import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const marketingLeads = pgTable(
  'marketing_leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    phone: text('phone'),
    trade: text('trade'),
    message: text('message'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    kindIdx: index('idx_marketing_leads_kind').on(t.kind),
    emailIdx: index('idx_marketing_leads_email').on(t.email),
    createdIdx: index('idx_marketing_leads_created').on(t.createdAt),
  }),
);
