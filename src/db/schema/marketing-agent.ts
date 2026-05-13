import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { aiConversations, aiMessages } from './ai';

export const marketingAgentMemories = pgTable(
  'marketing_agent_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    memoryType: text('memory_type').notNull().default('Strategy'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    confidence: text('confidence').notNull().default('Working'),
    source: text('source').notNull().default('Marketing Agent'),
    status: text('status').notNull().default('Active'),
    metadataJson: text('metadata_json'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_marketing_agent_memories_company').on(t.companyId),
    typeIdx: index('idx_marketing_agent_memories_type').on(t.companyId, t.memoryType),
    statusIdx: index('idx_marketing_agent_memories_status').on(t.companyId, t.status),
  }),
);

export const marketingAgentToolEvents = pgTable(
  'marketing_agent_tool_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => aiMessages.id, { onDelete: 'set null' }),
    toolName: text('tool_name').notNull(),
    status: text('status').notNull().default('succeeded'),
    reason: text('reason'),
    inputJson: text('input_json'),
    outputJson: text('output_json'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('idx_marketing_agent_tool_events_company').on(t.companyId),
    conversationIdx: index('idx_marketing_agent_tool_events_conversation').on(t.conversationId),
    toolIdx: index('idx_marketing_agent_tool_events_tool').on(t.companyId, t.toolName),
  }),
);
